import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getWorkspaceDir } from '../config'
import { emitEvent } from '../run/runEvents'
import { resolvePrompt } from '../run/resolvePrompt'
import { loadSkillText } from '../skills/skillLoader'
import { getProvider } from '../providers/registry'
import { runStore } from '../persistence/runStore'
import { getGraphAware, getGraphTemplate } from '../persistence/settingsStore'
import { verifyProtoDir } from '../verify/discParser'
import { buildGraphContext, buildWarehouseDirective } from './graphContext'

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

/** Parse a custom Verifier agent's `VERDICT: PASS|FAIL` line into a verdict. */
function parseCustomVerdict(text: string): NodeVerdict | undefined {
  const m = /VERDICT:\s*(PASS|FAIL)/i.exec(text)
  if (!m) return undefined
  const pass = m[1].toUpperCase() === 'PASS'
  return { distribution: { v: pass ? 1 : 0, p: 0, h: 0, c: pass ? 0 : 1 }, allCorrect: pass, results: 1 }
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

/** Workspace-relative file/folder paths a Files node references (multi + legacy single). */
function filePathsOf(cfg: Record<string, unknown> | undefined): string[] {
  const out: string[] = []
  if (Array.isArray(cfg?.paths)) {
    for (const p of cfg!.paths as unknown[]) if (typeof p === 'string' && p.trim()) out.push(p.trim())
  }
  if (typeof cfg?.path === 'string' && cfg.path.trim()) out.push(cfg.path.trim())
  return out
}

/** Text a data-source node contributes when wired into a downstream node. */
function valueForSource(src: GraphNode): string {
  const c = src.data.config ?? {}
  if (src.data.kind === 'idea') return String(c.text ?? '')
  if (src.data.kind === 'file') return filePathsOf(c).join('\n')
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
  if (node.data.kind === 'assemble') return `papers/${node.id}`
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
  // Every executed agent gets its own isolated dir. (Returning '' here used to
  // resolve to the WORKSPACE ROOT, so a body/literature agent feeding a
  // warehouse was told to write into — and collected from — the whole tree.)
  return `papers/${node.id}`
}

function resolveCwd(workingDir: string): string {
  const workspace = getWorkspaceDir()
  let dir = workspace
  if (workingDir.trim()) {
    const candidate = path.resolve(workspace, workingDir) // absolute paths pass through path.resolve
    // Confine to the workspace: an imported/shared graph must not point a run
    // (and its sandboxed tools) at an arbitrary directory like ~/.claude.
    const wsReal = path.resolve(workspace)
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

/**
 * Wipe every executable node's DEFAULT scratch dir (papers/<id>) so each whole-graph
 * run starts clean and intermediate files don't accumulate. Nodes with an explicit
 * workingDir are left alone; warehouses (durable piles under warehouse/) are never touched.
 */
export function clearDefaultScratch(nodes: GraphNode[], edges: GraphEdge[]): void {
  const SKIP = new Set(['idea', 'file', 'infocard', 'loopcontrol', 'warehouse'])
  for (const n of nodes) {
    if (SKIP.has(n.data.kind)) continue
    if (effectiveWorkingDir(n, nodes, edges) !== `papers/${n.id}`) continue // explicit dir → leave it
    try {
      rmSync(path.join(getWorkspaceDir(), 'papers', n.id), { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}

/** Stage wired Files nodes into <cwd>/inputs/ — each referenced file/folder, recursively. */
function stageFileInputs(node: GraphNode, nodes: GraphNode[], edges: GraphEdge[], cwd: string): boolean {
  let staged = false
  for (const e of edges) {
    if (e.target !== node.id) continue
    const src = nodes.find((n) => n.id === e.source)
    if (src?.data.kind !== 'file') continue
    for (const fp of filePathsOf(src.data.config)) {
      const abs = path.isAbsolute(fp) ? fp : path.resolve(getWorkspaceDir(), fp)
      try {
        if (!existsSync(abs)) continue
        mkdirSync(path.join(cwd, 'inputs'), { recursive: true })
        const dest = path.join(cwd, 'inputs', path.basename(abs))
        if (statSync(abs).isDirectory()) cpSync(abs, dest, { recursive: true })
        else copyFileSync(abs, dest)
        staged = true
      } catch {
        /* missing/locked path — skip */
      }
    }
  }
  return staged
}

/**
 * Stage each upstream AGENT's output files into <cwd>/inputs/<sourceLabel>/, so a
 * downstream agent reads the real artifacts — not just the upstream's reply text.
 * (Files nodes are handled by stageFileInputs; data nodes + warehouses are text-only.)
 */
function stageAgentOutputs(node: GraphNode, nodes: GraphNode[], edges: GraphEdge[], cwd: string): boolean {
  let staged = false
  for (const e of edges) {
    if (e.target !== node.id || e.type === 'feedback' || e.data?.loopBackEdge) continue
    const src = nodes.find((n) => n.id === e.source)
    if (!src || DATA_KINDS.has(src.data.kind) || src.data.kind === 'warehouse') continue
    const srcCwd = resolveCwd(effectiveWorkingDir(src, nodes, edges))
    if (srcCwd === cwd) continue // shared working dir (e.g. a loop body) — nothing to copy
    const label = String(src.data.label || src.data.kind).replace(/[^\w.\- ]/g, '_')
    for (const rel of collectableFiles(srcCwd)) {
      try {
        const dest = path.join(cwd, 'inputs', label, rel.split('/').join(path.sep))
        mkdirSync(path.dirname(dest), { recursive: true })
        copyFileSync(path.join(srcCwd, rel), dest)
        staged = true
      } catch {
        /* skip locked/missing */
      }
    }
  }
  return staged
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
  // The Warehouse node is a result sink, not an agent — it archives upstream
  // artifacts into an indexed pile instead of running a provider.
  if (node.data.kind === 'warehouse') return archiveWarehouse(node, nodes, edges, runId, opts.results ?? {})

  const cfg = node.data.config ?? {}
  const cwd = resolveCwd(effectiveWorkingDir(node, nodes, edges))

  // Does this agent feed a Warehouse? If so it MUST write real files into `cwd`
  // (the warehouse collects from disk). This is FUNCTIONAL — delivered below
  // regardless of the self-awareness toggle, with a disk backstop after the run.
  const feedsWarehouse = edges.some(
    (e) =>
      e.source === node.id &&
      e.type !== 'feedback' &&
      !e.data?.loopBackEdge &&
      nodes.find((n) => n.id === e.target)?.data.kind === 'warehouse',
  )
  const outputFile = `${String(node.data.label || node.data.kind).replace(/[^\w.\- ]/g, '_')}-output.md`

  const stagedFiles = stageFileInputs(node, nodes, edges, cwd)
  const stagedAgents = stageAgentOutputs(node, nodes, edges, cwd)
  const stagedInputs = stagedFiles || stagedAgents

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
  const needsAgent =
    node.data.kind === 'forge' || node.data.kind === 'temper' || node.data.kind === 'assemble'
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

  // The most-attended channel for weak models is the prompt itself — put the
  // load-bearing "write a file" pointer here too, not only in the system append.
  if (feedsWarehouse) {
    prompt += `\n\n---\nWhen you finish, WRITE your output as a real file in ${cwd} (e.g. ${outputFile}). Your chat reply is NOT collected — only files saved in that folder are.`
  }
  if (stagedInputs && provider.kind === 'agent') {
    prompt += `\n\nFiles from upstream steps are staged in your \`inputs/\` folder — read what you need from there.`
  }

  // Make the node self-aware: prepend an auto-generated map of where it sits in
  // the pipeline to its system prompt, then the user's own system append.
  const userAppend = typeof cfg.systemAppend === 'string' && cfg.systemAppend ? cfg.systemAppend : ''
  const graphContext = buildGraphContext(node, nodes, edges, {
    enabled: getGraphAware(),
    template: getGraphTemplate() ?? undefined,
    cwd,
  })
  // A custom Verifier agent emits a PASS/FAIL line the loop reads as its verdict,
  // so an until-pass loop can converge on a custom agent (not just Temper).
  const isVerifier = node.data.kind === 'custom' && cfg.verifier === true
  const passCondition = typeof cfg.passCondition === 'string' ? cfg.passCondition.trim() : ''
  const verifierDirective = isVerifier
    ? `## Loop verifier role\nYou are this loop's VERIFIER. Judge whether the work so far meets the PASS CONDITION. Reason briefly, then output EXACTLY one final line — \`VERDICT: PASS\` or \`VERDICT: FAIL\` — with nothing after it.\nPASS CONDITION: ${passCondition || '(not specified — judge whether the latest input is correct and complete)'}`
    : ''
  // The warehouse directive is FUNCTIONAL (not optional context) → built
  // unconditionally and placed FIRST, so it precedes the custom template + map.
  const warehouseDirective = feedsWarehouse ? buildWarehouseDirective(cwd, outputFile) : ''
  const systemAppend = [warehouseDirective, graphContext, userAppend, verifierDirective]
    .filter(Boolean)
    .join('\n\n---\n\n')

  const runResult = await provider.run({
    runId,
    nodeId: node.id,
    kind: node.data.kind,
    prompt,
    model: typeof cfg.model === 'string' ? cfg.model : undefined,
    effort: typeof cfg.effort === 'string' ? cfg.effort : undefined,
    systemAppend: systemAppend || undefined,
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
      const protoRel = path.relative(getWorkspaceDir(), protoDir).split(path.sep).join('/')
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
  } else if (runResult.ok && isVerifier) {
    // A custom Verifier agent: parse its PASS/FAIL line into the loop's verdict.
    const v = parseCustomVerdict(runResult.result ?? '')
    if (v) {
      verdict = v
      emitEvent(runId, {
        type: 'verdict',
        nodeId: node.id,
        distribution: v.distribution,
        allCorrect: v.allCorrect,
        results: v.results,
        ...(opts.iteration != null ? { iteration: opts.iteration } : {}),
      })
    }
  }

  // Backstop: an agent that feeds a warehouse but wrote NO collectable file
  // (weak models often only reply in text) — materialize its reply to disk so
  // the warehouse never silently collects nothing.
  if (runResult.ok && feedsWarehouse && runResult.result && !hasCollectableOutput(cwd)) {
    try {
      writeFileSync(path.join(cwd, outputFile), runResult.result)
    } catch {
      /* best-effort — disk full / locked */
    }
  }

  return { ok: runResult.ok, result: runResult.result, sessionId: runResult.sessionId, verdict }
}

// ---------------------------------------------------------------------------
// Warehouse — an output sink that piles upstream artifacts into indexed runs.
// ---------------------------------------------------------------------------

const EXT_FILTER: Record<string, string[] | null> = {
  pdf: ['.pdf'],
  md: ['.md'],
  tex: ['.tex'],
  img: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif'],
  all: null,
}
/** LaTeX build junk never worth piling, even under "Everything". */
const JUNK_EXT = new Set(['.aux', '.fls', '.fdb_latexmk', '.log', '.out', '.toc', '.synctex'])

/** Relative paths of real output files under `dir` (skip inputs/deps/vcs/junk/skill). */
function collectableFiles(dir: string): string[] {
  const out: string[] = []
  const walk = (d: string, rel: string): void => {
    let ents
    try {
      ents = readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of ents) {
      if (ent.name === 'inputs' || ent.name === 'node_modules' || ent.name === '.git') continue
      const child = rel ? `${rel}/${ent.name}` : ent.name
      if (ent.isDirectory()) {
        walk(path.join(d, ent.name), child)
        continue
      }
      if (ent.name.startsWith('.skill-')) continue
      const lower = ent.name.toLowerCase()
      if (lower.endsWith('.synctex.gz') || JUNK_EXT.has(path.extname(lower))) continue
      out.push(child)
    }
  }
  walk(dir, '')
  return out
}

/** Did an agent leave ANY real output file under `dir`? */
function hasCollectableOutput(dir: string): boolean {
  return collectableFiles(dir).length > 0
}

async function archiveWarehouse(
  node: GraphNode,
  nodes: GraphNode[],
  edges: GraphEdge[],
  runId: string,
  upstream: Record<string, string>,
): Promise<RunOneResult> {
  emitEvent(runId, { type: 'status', nodeId: node.id, status: 'running' })
  runStore.upsertNodeRun({ runId, nodeId: node.id, kind: node.data.kind, status: 'running' })

  const cfg = node.data.config ?? {}
  // Default to 'all' — the warehouse is a catch-all sink; a specific type is
  // just an optional filter. Unknown/legacy values (e.g. an old saved graph)
  // also fall through to 'all' rather than the narrowest filter.
  const collect = typeof cfg.collect === 'string' ? cfg.collect : 'all'
  const exts = collect in EXT_FILTER ? EXT_FILTER[collect] : EXT_FILTER.all
  const matches = (name: string): boolean => {
    const lower = name.toLowerCase()
    if (lower.endsWith('.synctex.gz')) return false // latex build junk; other .gz are kept
    const ext = path.extname(lower)
    return exts ? exts.includes(ext) : !JUNK_EXT.has(ext)
  }

  // Stable, user-settable pile name (defaults to the node id for back-compat).
  // Reusing a name lets a fresh node re-attach to (restore) an existing pile.
  const whNameRaw = typeof cfg.warehouseName === 'string' ? cfg.warehouseName.trim() : ''
  const whName = whNameRaw ? whNameRaw.replace(/[^\w.\- ]/g, '_') : node.id
  const base = path.join(getWorkspaceDir(), 'warehouse', whName)
  mkdirSync(base, { recursive: true })
  const prior = readdirSync(base).filter((d) => /^run-\d+/.test(d))
  const idx = String(prior.length + 1).padStart(3, '0')
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const runDir = path.join(base, `run-${idx}-${ts}`)

  let count = 0
  const skipped: string[] = [] // output files found but excluded by the filter — used for a helpful message
  const srcEdges = edges.filter((e) => e.target === node.id && e.type !== 'feedback' && !e.data?.loopBackEdge)
  for (const e of srcEdges) {
    const src = nodes.find((n) => n.id === e.source)
    if (!src || DATA_KINDS.has(src.data.kind)) continue // data nodes produce no artifacts
    const srcCwd = resolveCwd(effectiveWorkingDir(src, nodes, edges))
    const label = String(src.data.label || src.data.kind).replace(/[^\w.\- ]/g, '_')
    // Recursively collect matching OUTPUT files from the agent's working dir
    // (incl. proto/), skipping staged inputs, the skill file, vcs/deps + junk.
    const hits: string[] = []
    const walkOut = (dir: string, rel: string): void => {
      let ents
      try {
        ents = readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const ent of ents) {
        if (ent.name === 'inputs' || ent.name === 'node_modules' || ent.name === '.git') continue
        const rChild = rel ? `${rel}/${ent.name}` : ent.name
        if (ent.isDirectory()) walkOut(path.join(dir, ent.name), rChild)
        else if (!ent.name.startsWith('.skill-')) {
          if (matches(ent.name)) hits.push(rChild)
          else skipped.push(ent.name)
        }
      }
    }
    walkOut(srcCwd, '')
    if (!hits.length) continue
    mkdirSync(runDir, { recursive: true })
    for (const r of hits) {
      try {
        // Flat naming (label__path) so the gallery lists a run in one call.
        copyFileSync(path.join(srcCwd, r), path.join(runDir, `${label}__${r.replace(/\//g, '_')}`))
        count++
      } catch {
        /* skip */
      }
    }
  }

  const rel = path.relative(getWorkspaceDir(), runDir).split(path.sep).join('/')
  let result: string
  if (count > 0) {
    result = `Archived ${count} file(s) → ${rel}`
  } else if (skipped.length) {
    // Files existed but the filter excluded them — tell the user exactly what + how to fix.
    const sample = [...new Set(skipped)].slice(0, 6).join(', ')
    result = `Nothing archived — Collect is "${collect}" but the output files found were: ${sample}. Set Collect to "Everything" to keep them.`
  } else {
    result = `Nothing to archive — the upstream agent(s) wrote no output files to disk.`
  }
  emitEvent(runId, { type: 'result', nodeId: node.id, ok: true, result })
  emitEvent(runId, { type: 'status', nodeId: node.id, status: 'done' })
  runStore.upsertNodeRun({ runId, nodeId: node.id, status: 'done', result, structured: { dir: rel, count } })

  // Pass-through tap: forward the merged upstream output so a node wired from
  // this warehouse's `out` still receives the content (it was archived too).
  // The visible node result stays the archive summary; only the threaded value
  // downstream becomes the content. Falls back to the summary if there's none.
  const forwarded = srcEdges
    .map((e) => upstream[e.source])
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join('\n\n')
  return { ok: true, result: forwarded || result }
}
