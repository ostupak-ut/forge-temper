import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { WORKSPACE_DIR } from '../config'
import { emitEvent } from '../run/runEvents'
import { resolvePrompt } from '../run/resolvePrompt'
import { loadSkillText } from '../skills/skillLoader'
import { getProvider } from '../providers/registry'
import { runStore } from '../persistence/runStore'
import { verifyProtoDir } from '../verify/discParser'

/**
 * Per-node execution, extracted from the old runs.ts `mode:'single'` IIFE so the
 * graph scheduler and the loop driver can reuse the exact same logic. Preserves:
 *   - File-input staging into <cwd>/inputs/
 *   - prompt resolution via resolvePrompt (with extra vars for loop injection)
 *   - provider dispatch + the needsAgent gate
 *   - skill delivery (.skill-<name>.md for agents, inlined for chat)
 *   - the forge/temper verdict emission (verifyProtoDir over proto/)
 */

export interface GraphNode {
  id: string
  data: { kind: string; label: string; config: Record<string, unknown> }
}
export interface GraphEdge {
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type?: string
  data?: Record<string, unknown>
}

export interface NodeVerdict {
  distribution: { v: number; p: number; h: number; c: number }
  allCorrect: boolean
  results: number
  protoDir?: string
}

export interface RunOneOpts {
  /** Extra {{var}} substitutions (e.g. temper_report/feedback injected by the loop driver). */
  vars?: Record<string, string>
  /** Upstream agent outputs keyed by node id, so a wired agent's result feeds in. */
  results?: Record<string, string>
  /** Resume a prior agent session so context compounds across loop iterations. */
  resumeSessionId?: string
  /** 1-based iteration index for forge/temper proto staging + verdict tagging. */
  iteration?: number
  /** Tag verdict events with the loop id (loop driver supplies this). */
  loopId?: string
}

export interface RunOneResult {
  ok: boolean
  result: string
  sessionId?: string
  verdict?: NodeVerdict
}

const ALL_TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']

/** Default tool scope per node kind (bypassPermissions still applies). */
export function allowedToolsFor(kind: string, cfg?: Record<string, unknown>): string[] {
  switch (kind) {
    case 'forge':
      return ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']
    case 'temper':
      return ['Read', 'Write', 'Bash', 'Glob', 'Grep']
    case 'custom': {
      // The Custom Agent node carries its own configurable tool scope.
      const scope = Array.isArray(cfg?.toolScope)
        ? (cfg!.toolScope as unknown[]).filter((t): t is string => typeof t === 'string')
        : []
      return scope.length ? scope : ALL_TOOLS
    }
    case 'body':
    case 'literature':
      return ['Read', 'Edit', 'Write', 'Glob', 'Grep']
    case 'assemble':
      return ['Read', 'Write', 'Bash']
    default:
      return ['Read', 'Glob', 'Grep']
  }
}

/** Data-source node kinds whose value comes from their CONFIG (not a run). */
const DATA_KINDS = new Set(['idea', 'file', 'infocard'])

/** Text a data-source node contributes when wired into a downstream node. */
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

/**
 * Build the {{var}} context from ALL wired forward inputs, keyed by target port.
 * Any agent can "eat" ANYTHING you connect: MULTIPLE sources on the same port are
 * MERGED (labelled), data-source nodes contribute their config value, and agent
 * sources contribute their runtime output (threaded in via `results`). Returns
 * the ctx plus the list of port keys that actually received input.
 */
function resolveSourceInputs(
  node: GraphNode,
  nodes: GraphNode[],
  edges: GraphEdge[],
  results: Record<string, string>,
): { ctx: Record<string, string>; keys: string[] } {
  const byPort = new Map<string, string[]>()
  for (const e of edges) {
    if (e.target !== node.id) continue
    // Skip the loop back-edge — its value is injected via opts.vars by the driver.
    if (e.type === 'feedback' || e.data?.loopBackEdge) continue
    const src = nodes.find((n) => n.id === e.source)
    if (!src) continue
    const portId = (e.targetHandle ?? '').replace(/^in:/, '')
    if (!portId) continue
    const v = DATA_KINDS.has(src.data.kind) ? valueForSource(src) : (results[src.id] ?? '')
    if (v) (byPort.get(portId) ?? byPort.set(portId, []).get(portId)!).push(v)
  }
  const ctx: Record<string, string> = {}
  for (const [port, vals] of byPort) {
    ctx[port] =
      vals.length > 1 ? vals.map((v, i) => `[${port} ${i + 1}/${vals.length}]\n${v}`).join('\n\n') : vals[0]
  }
  return { ctx, keys: [...byPort.keys()] }
}

/**
 * forge/temper/custom share a paper's working dir so temper reads forge's proto/.
 * temper inherits the upstream forge node's dir unless it sets its own.
 */
export function effectiveWorkingDir(node: GraphNode, nodes: GraphNode[], edges: GraphEdge[]): string {
  const own = typeof node.data.config?.workingDir === 'string' ? node.data.config.workingDir.trim() : ''
  if (own) return own
  if (node.data.kind === 'forge') return `papers/${node.id}`
  if (node.data.kind === 'custom') return `papers/${node.id}`
  if (node.data.kind === 'temper') {
    // Find the upstream FORGE among ALL incoming edges (not just the first one,
    // which may be an InfoCard/other input) so temper reads forge's proto/.
    const forge = edges
      .filter((e) => e.target === node.id)
      .map((e) => nodes.find((n) => n.id === e.source && n.data.kind === 'forge'))
      .find((n): n is GraphNode => Boolean(n))
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
    const candidate = path.resolve(WORKSPACE_DIR, workingDir) // absolute paths pass through path.resolve
    // Confine to the workspace: an imported/shared graph must not point a run
    // (and its sandboxed tools) at an arbitrary directory like ~/.claude.
    const wsReal = path.resolve(WORKSPACE_DIR)
    if (candidate === wsReal || candidate.startsWith(wsReal + path.sep)) {
      dir = candidate
    } else {
      dir = path.join(wsReal, 'papers', path.basename(candidate) || 'run')
    }
  }
  try {
    mkdirSync(dir, { recursive: true })
  } catch {
    /* ignore */
  }
  return dir
}

/** Stage any wired File nodes into <cwd>/inputs/ so the skill reads them. */
function stageFileInputs(node: GraphNode, nodes: GraphNode[], edges: GraphEdge[], cwd: string): void {
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
}

/**
 * Run one node end-to-end. Emits status/token/tool/result/verdict via the
 * provider + this function; returns ok + an optional computed verdict so the
 * loop driver can decide whether to keep iterating.
 */
export async function runOneNode(
  node: GraphNode,
  nodes: GraphNode[],
  edges: GraphEdge[],
  runId: string,
  signal: AbortSignal,
  opts: RunOneOpts = {},
): Promise<RunOneResult> {
  const cfg = node.data.config ?? {}
  const cwd = resolveCwd(effectiveWorkingDir(node, nodes, edges))

  stageFileInputs(node, nodes, edges, cwd)

  const promptTemplate = String(cfg.prompt ?? '')
  const { ctx: srcCtx, keys: inputKeys } = resolveSourceInputs(node, nodes, edges, opts.results ?? {})
  const ctx: Record<string, string> = {
    iteration: String(opts.iteration ?? 1),
    proto_dir: cwd,
    field: String(cfg.field ?? ''),
    ...srcCtx,
    ...(opts.vars ?? {}),
  }
  let prompt = resolvePrompt(promptTemplate, ctx) || `Run the ${node.data.kind} step.`

  // "Eat anything": fold any wired input the prompt didn't explicitly reference
  // into an Additional-inputs block, so nothing you connect is silently dropped.
  const refd = (k: string) => promptTemplate.includes(`{{${k}}}`)
  const extras: string[] = []
  for (const k of inputKeys) if (srcCtx[k] && !refd(k)) extras.push(`### ${k}\n${srcCtx[k]}`)
  const fb = opts.vars?.feedback ?? opts.vars?.temper_report
  if (fb && !refd('feedback') && !refd('temper_report')) extras.push(`### feedback (previous verdict)\n${fb}`)
  if (extras.length) prompt += `\n\n## Additional inputs\n\n${extras.join('\n\n')}`
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
  // working dir (avoids the Skill tool, which hangs headless, AND the Windows
  // command-line length limit on a 68 KB system prompt). Chat providers get it
  // inlined as a system message (HTTP body, no limit).
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
    effort: typeof cfg.effort === 'string' ? cfg.effort : undefined,
    systemAppend: typeof cfg.systemAppend === 'string' && cfg.systemAppend ? cfg.systemAppend : undefined,
    cwd,
    allowedTools: allowedToolsFor(node.data.kind, cfg),
    skillText: skillTextForChat,
    resumeSessionId: opts.resumeSessionId,
    signal,
  })

  // Derive a computed verdict from forge/temper's proto/ artifacts.
  let verdict: NodeVerdict | undefined
  if (runResult.ok && (node.data.kind === 'forge' || node.data.kind === 'temper')) {
    const protoDir = path.join(cwd, 'proto')
    const v = await verifyProtoDir(protoDir)
    if (v) {
      const protoRel = path.relative(WORKSPACE_DIR, protoDir).split(path.sep).join('/')
      verdict = {
        distribution: v.distribution,
        allCorrect: v.allCorrect,
        results: v.results,
        protoDir: protoRel,
      }
      emitEvent(runId, {
        type: 'verdict',
        nodeId: node.id,
        distribution: v.distribution,
        allCorrect: v.allCorrect,
        results: v.results,
        protoDir: protoRel,
        ...(opts.iteration != null ? { iteration: opts.iteration } : {}),
      })
      runStore.upsertNodeRun({
        runId,
        nodeId: node.id,
        status: 'done',
        structured: { ...v, protoDir: protoRel },
      })
    }
  }

  return { ok: runResult.ok, result: runResult.result, sessionId: runResult.sessionId, verdict }
}
