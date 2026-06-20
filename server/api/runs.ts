import type { FastifyInstance } from 'fastify'
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { RunEvent } from '@shared/contracts'
import { WORKSPACE_DIR } from '../config'
import { createBus, emitEvent, endBus, getBus } from '../run/runEvents'
import { resolvePrompt } from '../run/resolvePrompt'
import { loadSkillText } from '../skills/skillLoader'
import { getProvider } from '../providers/registry'
import { runStore } from '../persistence/runStore'
import { verifyProtoDir } from '../verify/discParser'

interface GraphNode {
  id: string
  data: { kind: string; label: string; config: Record<string, unknown> }
}
interface GraphEdge {
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

/** Text a source node contributes when wired into a downstream node. */
function valueForSource(src: GraphNode): string {
  const c = src.data.config ?? {}
  if (src.data.kind === 'idea') return String(c.text ?? '')
  if (src.data.kind === 'file') return String(c.path ?? '')
  if (src.data.kind === 'infocard') {
    return [c.title && `Title: ${c.title}`, c.abstract && `Abstract: ${c.abstract}`]
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

/** Map a node's connected source inputs into {{var}} context keyed by input port id. */
function resolveSourceInputs(node: GraphNode, nodes: GraphNode[], edges: GraphEdge[]): Record<string, string> {
  const ctx: Record<string, string> = {}
  for (const e of edges) {
    if (e.target !== node.id) continue
    const src = nodes.find((n) => n.id === e.source)
    if (!src) continue
    const portId = (e.targetHandle ?? '').replace(/^in:/, '')
    const v = valueForSource(src)
    if (v) ctx[portId] = v
  }
  return ctx
}

let seq = 0
const newRunId = () => `run-${Date.now().toString(36)}-${(++seq).toString(36)}`

/** Default tool scope per node kind (bypassPermissions still applies). */
function allowedToolsFor(kind: string): string[] {
  switch (kind) {
    case 'forge':
      return ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']
    case 'temper':
      return ['Read', 'Write', 'Bash', 'Glob', 'Grep']
    case 'body':
    case 'literature':
      return ['Read', 'Edit', 'Write', 'Glob', 'Grep']
    case 'assemble':
      return ['Read', 'Write', 'Bash']
    default:
      return ['Read', 'Glob', 'Grep']
  }
}

/**
 * forge/temper share a paper's working dir so temper reads forge's proto/.
 * temper inherits the upstream forge node's dir unless it sets its own.
 */
function effectiveWorkingDir(node: GraphNode, nodes: GraphNode[], edges: GraphEdge[]): string {
  const own = typeof node.data.config?.workingDir === 'string' ? node.data.config.workingDir.trim() : ''
  if (own) return own
  if (node.data.kind === 'forge') return `papers/${node.id}`
  if (node.data.kind === 'temper') {
    const inc = edges.find((e) => e.target === node.id)
    const forge = inc && nodes.find((n) => n.id === inc.source && n.data.kind === 'forge')
    if (forge) {
      const fOwn = typeof forge.data.config?.workingDir === 'string' ? forge.data.config.workingDir.trim() : ''
      return fOwn || `papers/${forge.id}`
    }
  }
  return ''
}

function resolveCwd(workingDir: string): string {
  let dir = WORKSPACE_DIR
  if (workingDir.trim()) {
    dir = path.isAbsolute(workingDir) ? workingDir : path.resolve(WORKSPACE_DIR, workingDir)
  }
  try {
    mkdirSync(dir, { recursive: true })
  } catch {
    /* ignore */
  }
  return dir
}

export async function runRoutes(app: FastifyInstance) {
  app.post('/api/runs', async (req, reply) => {
    const body = req.body as {
      mode?: string
      nodeId?: string
      graph?: { nodes: GraphNode[]; edges?: GraphEdge[] }
    }
    const nodes = body?.graph?.nodes ?? []
    const edges = body?.graph?.edges ?? []
    const node = nodes.find((n) => n.id === body.nodeId)
    if (!node) return reply.code(400).send({ error: 'node not found in graph' })

    const runId = newRunId()
    const bus = createBus(runId)
    runStore.createRun(runId, `single:${node.data.kind}`)

    void (async () => {
      try {
        const cfg = node.data.config ?? {}
        const cwd = resolveCwd(effectiveWorkingDir(node, nodes, edges))

        // Stage any wired File nodes into <cwd>/inputs/ so the skill reads them.
        for (const e of edges) {
          if (e.target !== node.id) continue
          const src = nodes.find((n) => n.id === e.source)
          if (src?.data.kind !== 'file') continue
          const fp = typeof src.data.config?.path === 'string' ? src.data.config.path.trim() : ''
          if (!fp) continue
          const abs = path.isAbsolute(fp) ? fp : path.resolve(WORKSPACE_DIR, fp)
          const stageAs =
            (typeof src.data.config?.stageAs === 'string' && src.data.config.stageAs.trim()) || path.basename(abs)
          try {
            mkdirSync(path.join(cwd, 'inputs'), { recursive: true })
            copyFileSync(abs, path.join(cwd, 'inputs', stageAs))
          } catch {
            /* missing/locked file — skip */
          }
        }

        const ctx = {
          iteration: '1',
          proto_dir: cwd,
          field: String(cfg.field ?? ''),
          ...resolveSourceInputs(node, nodes, edges),
        }
        let prompt = resolvePrompt(String(cfg.prompt ?? ''), ctx) || `Run the ${node.data.kind} step.`
        const provider = getProvider(typeof cfg.provider === 'string' ? cfg.provider : undefined)

        // forge/temper do real agentic work (write files, run sympy/latexmk),
        // so they need an agentic provider. Prose/other nodes run on any provider.
        const needsAgent = node.data.kind === 'forge' || node.data.kind === 'temper'
        if (needsAgent && provider.kind !== 'agent') {
          throw new Error(
            `${node.data.kind} needs an agentic provider (e.g. Claude Code) — ${provider.label} is chat-only for now.`,
          )
        }

        // Deliver the skill's instructions. Agents READ it from a file in their
        // working dir (avoids the Skill tool, which hangs headless, AND the
        // Windows command-line length limit on a 68 KB system prompt). Chat
        // providers get it inlined as a system message (HTTP body, no limit).
        const skill = typeof cfg.skill === 'string' ? cfg.skill : ''
        const skillText = skill ? loadSkillText(skill) : null
        let skillTextForChat: string | undefined
        if (skill && skillText) {
          if (provider.kind === 'agent') {
            const skillFile = `.skill-${skill}.md`
            try {
              writeFileSync(path.join(cwd, skillFile), skillText)
              prompt = `First, read the file "${skillFile}" in your working directory and follow its instructions EXACTLY, working fully autonomously end-to-end — do NOT pause to ask me to confirm anything.\n\n${prompt}`
            } catch {
              /* fall through with bare prompt */
            }
          } else {
            skillTextForChat = skillText
          }
        }

        const runResult = await provider.run({
          runId,
          nodeId: node.id,
          kind: node.data.kind,
          prompt,
          model: typeof cfg.model === 'string' ? cfg.model : undefined,
          systemAppend: typeof cfg.systemAppend === 'string' && cfg.systemAppend ? cfg.systemAppend : undefined,
          cwd,
          allowedTools: allowedToolsFor(node.data.kind),
          skillText: skillTextForChat,
          signal: bus.ac.signal,
        })

        // Phase 3: derive a computed verdict from forge/temper's proto/ artifacts.
        if (runResult.ok && (node.data.kind === 'forge' || node.data.kind === 'temper')) {
          const protoDir = path.join(cwd, 'proto')
          const verdict = await verifyProtoDir(protoDir)
          if (verdict) {
            const protoRel = path.relative(WORKSPACE_DIR, protoDir).split(path.sep).join('/')
            emitEvent(runId, {
              type: 'verdict',
              nodeId: node.id,
              distribution: verdict.distribution,
              allCorrect: verdict.allCorrect,
              results: verdict.results,
              protoDir: protoRel,
            })
            runStore.upsertNodeRun({ runId, nodeId: node.id, status: 'done', structured: { ...verdict, protoDir: protoRel } })
          }
        }

        runStore.finishRun(runId, bus.ac.signal.aborted ? 'stopped' : 'done')
        emitEvent(runId, { type: 'run-done', status: bus.ac.signal.aborted ? 'stopped' : 'done' })
      } catch (e) {
        runStore.finishRun(runId, 'error')
        emitEvent(runId, { type: 'error', nodeId: node.id, error: String((e as Error)?.message ?? e) })
        emitEvent(runId, { type: 'run-done', status: 'error' })
      } finally {
        endBus(runId)
      }
    })()

    return { runId }
  })

  app.post('/api/runs/:id/stop', async (req) => {
    const { id } = req.params as { id: string }
    getBus(id)?.ac.abort()
    return { ok: true }
  })

  app.get('/api/runs/:id', async (req) => {
    const { id } = req.params as { id: string }
    return runStore.getRun(id) ?? { error: 'not found' }
  })

  app.get('/api/runs/:id/stream', (req, reply) => {
    const { id } = req.params as { id: string }
    const bus = getBus(id)
    reply.hijack()
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    const send = (ev: RunEvent) => reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`)

    if (!bus) {
      send({ type: 'run-done', status: 'error' })
      reply.raw.end()
      return
    }
    for (const ev of [...bus.events]) send(ev)
    if (bus.done) {
      reply.raw.end()
      return
    }
    const onEv = (ev: RunEvent) => send(ev)
    const onEnd = () => {
      cleanup()
      reply.raw.end()
    }
    const cleanup = () => {
      bus.emitter.off('ev', onEv)
      bus.emitter.off('end', onEnd)
    }
    bus.emitter.on('ev', onEv)
    bus.emitter.on('end', onEnd)
    req.raw.on('close', cleanup)
  })
}
