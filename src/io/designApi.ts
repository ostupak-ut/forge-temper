import type { Edge } from '@xyflow/react'
import type { FtNode } from '@/store/graphStore'
import { ALL_KINDS, getSpec } from '@/registry/nodeSpecs'
import { ICON_NAMES } from '@/registry/icons'
import { arePortsCompatible, handleId } from '@/registry/portTypes'
import type { NodeKind } from '@/registry/types'

/** Vibrant palette + keyword→icon guess, used to make generated agents fun. */
const FUN_PALETTE = [
  '#f43f5e', '#fb923c', '#facc15', '#22c55e', '#14b8a6',
  '#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#84cc16',
]

const ICON_HINTS: [RegExp, string][] = [
  [/research|gather|search|find|scout|collect|mine|scrape/i, 'Search'],
  [/data|dataset|extract|parse/i, 'Microscope'],
  [/analy|risk|monte|profit|cost|calc|budget|finance/i, 'Calculator'],
  [/compare|score|rank|evaluat|decision|select/i, 'Scale'],
  [/write|draft|author|compose|generat/i, 'PenTool'],
  [/edit|polish|review|proofread|refine/i, 'Feather'],
  [/plan|calendar|schedule|timeline|operation/i, 'Compass'],
  [/idea|recommend|suggest|variety|brainstorm/i, 'Lightbulb'],
  [/build|compile|assemble|construct/i, 'Hammer'],
  [/code|program|script|develop/i, 'Code'],
  [/valid|verify|check|test|qualit|guard/i, 'Shield'],
  [/report|summar|compile|document/i, 'BookOpen'],
  [/science|experiment|lab|chem/i, 'FlaskConical'],
]

function guessSymbol(label: string): string | undefined {
  for (const [re, icon] of ICON_HINTS) if (re.test(label)) return icon
  return undefined
}

export interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

/** Compact machine-readable catalog of every node kind, ports and config keys. */
function buildCatalog() {
  return ALL_KINDS.map((kind) => {
    const s = getSpec(kind)
    return {
      kind,
      label: s.label,
      desc: s.description,
      inputs: s.inputs.map((p) => ({ id: p.id, type: p.type, ...(p.required ? { required: true } : {}) })),
      outputs: s.outputs.map((p) => ({ id: p.id, type: p.type })),
      config: Object.keys(s.defaultConfig),
    }
  })
}

export function buildSystemPrompt(context?: string): string {
  return [
    'You are the workflow architect for "FORGE", a visual tool for wiring AI agents into pipelines. Design a directed graph of typed nodes that satisfies the user request — for ANY kind of multi-step agent workflow, not just academic ones.',
    '',
    ...(context && context.trim()
      ? [
          'CONTEXT — build AROUND what already exists; do NOT ignore it:',
          context.trim(),
          'If the user has files or a partial graph already, incorporate them: add File nodes whose paths point to the existing files and wire them into the agents that need them.',
          'EDITING an existing graph: REUSE the exact node id shown (id=…) for every node you keep or modify — only invent new ids for genuinely NEW nodes. When the user asks to edit/extend (not start over), return the COMPLETE resulting graph (all kept nodes with their ids + the changes); the user can Replace or Merge. Never silently drop existing nodes.',
          '',
        ]
      : []),
    'NODE CATALOG (kind → ports & config keys):',
    JSON.stringify(buildCatalog()),
    '',
    'PORT TYPING: an edge joins an output port to an input port. Types must match, EXCEPT type "any" connects to anything, and "verified" may also feed a "paper" input. Inputs marked required:true must be fed.',
    '',
    'GENERAL BUILDING BLOCKS — prefer these by default:',
    '- "custom" (Custom Agent): the PRIMARY block — a freely-wireable agent for ANY task. Its "in"/"out" ports are type "any", so custom agents chain into one another and accept any upstream output. Give each a clear label and a config.prompt describing its job. Build most workflows by chaining several custom agents.',
    '- "idea" (Prompt): a sticky note holding seed text / instructions; feeds the first agent.',
    '- "file" (File): stages documents or folders into an agent\'s "inputs" port.',
    '- "warehouse" (Warehouse): collects any agent output and accumulates it across runs.',
    '',
    'SPECIALIZED PAPER-PROTOTYPING NODES — use ONLY when the user EXPLICITLY asks for academic theory-paper prototyping, or names these steps: "forge" (drafts a paper from an idea), "temper" (verifies it; its "report" can loop back to forge "feedback"), "body"/"literature" (write sections), "assemble" (compiles LaTeX). Do NOT pull these into a general workflow — use custom agents instead.',
    '',
    'VISUAL STYLE: make the graph fun — give EVERY node a distinct vibrant config.color (hex) and a config.symbol icon that fits its role, chosen ONLY from this list: ' +
      ICON_NAMES.join(', ') +
      '. e.g. research/search → Search or Microscope; analysis/risk/cost → Calculator or Scale; writing → PenTool; editing → Feather; planning/calendar → Compass; ideas/recommendations → Lightbulb; building/compiling → Hammer or Code; validation → Shield; reporting → BookOpen. Vary the colors so adjacent agents differ.',
    '',
    'MODEL SELECTION: set config.model and config.effort per node to fit the task — do NOT default everything to the biggest model. Heavy reasoning / synthesis / verification / long-form writing → "claude-opus-4-8" + effort "high". Everyday drafting / transformation → "claude-sonnet-4-6" + effort "medium". Light / mechanical work (formatting, extraction, classification, simple lookups, splitting, merging) → "claude-haiku-4-5" + effort "low". Prefer the lighter, faster model whenever a step is simple; reserve Opus for the genuinely hard nodes. If unsure, omit config.model (it inherits the session default).',
    '',
    'MEDIA GENERATION (images & video): ONLY when the user asks to GENERATE an image or a video, use a "custom" node and set BOTH config.provider and a matching config.model (these models are NOT Claude/text models):',
    '- Image → config.provider "openrouter-image" + an image model id, e.g. "google/gemini-3-pro-image", "google/gemini-3.1-flash-image", or "openai/gpt-5-image". config.prompt is the image description. Synchronous.',
    '- Video → config.provider "openrouter-video" + a video model id, e.g. "google/veo-3.1" or "google/veo-3.1-lite" (lite = cheaper/faster). config.prompt is the shot description. Async — can take minutes.',
    '- A media node OUTPUTS a file: wire its "out" into a Warehouse to collect the result (you may set that warehouse config.collect to "img" for images or "vid" for video). Do NOT put config.effort, config.skill, or "write a file" instructions on media nodes. Pick the correct provider for the modality the user asked for — image vs video. For all NON-generation nodes, omit config.provider so they inherit the default agent provider.',
    '',
    'MEDIA STITCHING (joining clips into one video): to COMBINE / CONCATENATE / STITCH photos and/or videos into a SINGLE video file, use the "glue" node — it runs ffmpeg deterministically (NOT an AI model: no config.provider, model, prompt, or skill). Wire every photo (a File node) and every video (a File node OR an upstream openrouter-video node) into the glue node\'s "media" input. Stills become short clips; inputs are joined in FILE-NAME order, so tell the user to prefix names 01_/02_ to control sequence. Optional config: outputName, width/height (0 = match the first video), fps, imageDuration (seconds per photo). Wire the glue node\'s "out" into a Warehouse to keep the result. Use glue for "stitch/join/combine/concatenate clips", photo intros/outros, or assembling several generated shots into one final video. Do NOT use a custom agent for plain concatenation — glue is deterministic and free.',
    '',
    'OUTPUT FORMAT: reply with ONE or two sentences of explanation, then a SINGLE fenced ```json block of exactly this shape:',
    '{"nodes":[{"id":"n1","kind":"<catalog kind>","label":"...","config":{"prompt":"...","model":"claude-sonnet-4-6","effort":"medium","symbol":"Search","color":"#0ea5e9"}}],"edges":[{"from":"n1","fromPort":"<output id>","to":"n2","toPort":"<input id>","feedback":false}]}',
    'RULES: default to "custom" agents (plus idea/file/warehouse) for general requests; only use forge/temper/body/literature/assemble when the user explicitly wants the paper pipeline. Use the EXACT port ids from the catalog (for custom agents that means "in"/"out"); give every node a unique id, a descriptive label, a fitting config.symbol, a fun config.color, and a task-appropriate config.model/effort; for agent nodes set a useful config.prompt; set "feedback":true ONLY on an edge that closes a loop; do NOT include x/y positions (auto-laid-out). Keep it minimal and valid.',
  ].join('\n')
}

export async function requestDesign(
  provider: string,
  model: string,
  messages: ChatMsg[],
  context?: string,
  signal?: AbortSignal,
): Promise<string> {
  const r = await fetch('/api/design', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model, system: buildSystemPrompt(context), messages }),
    signal,
  })
  const d = await r.json()
  if (!d.ok) throw new Error(d.error ?? 'design request failed')
  return String(d.text ?? '')
}

/** Pull the JSON graph object out of an LLM reply (last fenced block wins). */
function extractGraphJson(text: string): { nodes?: unknown[]; edges?: unknown[] } | null {
  const candidates: string[] = []
  for (const m of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)) candidates.push(m[1])
  candidates.push(text)
  for (const c of candidates.reverse()) {
    const s = c.indexOf('{')
    const e = c.lastIndexOf('}')
    if (s < 0 || e <= s) continue
    try {
      const obj = JSON.parse(c.slice(s, e + 1))
      if (obj && Array.isArray(obj.nodes)) return obj
    } catch {
      /* try next candidate */
    }
  }
  return null
}

/**
 * Resolve an edge's handles. Prefer the LLM's port ids, but if they don't exist
 * on the node (it often says "in"/"out"), fall back to a type-compatible port so
 * the edge still connects. Feedback edges target the loop-internal input.
 */
function resolveHandles(
  srcKind: NodeKind,
  tgtKind: NodeKind,
  fromPort: string,
  toPort: string,
  feedback: boolean,
): { sourceHandle: string; targetHandle: string } | null {
  const outs = getSpec(srcKind).outputs
  const ins = getSpec(tgtKind).inputs
  if (!outs.length || !ins.length) return null

  let out = outs.find((p) => p.id === fromPort)
  let inp = ins.find((p) => p.id === toPort)

  if (feedback) {
    const fb = ins.find((p) => p.loopInternal)
    if (fb && (!inp || !inp.loopInternal)) inp = fb
  }
  if (!out) out = (inp && outs.find((p) => arePortsCompatible(p.type, inp!.type))) || outs[0]
  if (!inp) {
    const usable = ins.filter((p) => (feedback ? true : !p.loopInternal))
    inp = usable.find((p) => arePortsCompatible(out!.type, p.type)) || usable[0] || ins[0]
  }
  if (!out || !inp) return null
  return { sourceHandle: handleId('out', out.id), targetHandle: handleId('in', inp.id) }
}

/**
 * Layered left-to-right layout over forward (non-feedback) edges, made pretty:
 * generous spacing, each layer vertically centered, barycenter ordering to cut
 * edge crossings, and a gentle stagger so it reads organic rather than gridded.
 */
function layout(nodes: FtNode[], edges: Edge[]): FtNode[] {
  const H_GAP = 360
  const V_GAP = 210
  const ids = new Set(nodes.map((n) => n.id))
  const fwd = edges.filter((e) => e.type !== 'feedback' && ids.has(e.source) && ids.has(e.target))

  const indeg = new Map<string, number>()
  const adj = new Map<string, string[]>()
  const preds = new Map<string, string[]>()
  nodes.forEach((n) => indeg.set(n.id, 0))
  for (const e of fwd) {
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1)
    ;(adj.get(e.source) ?? adj.set(e.source, []).get(e.source)!).push(e.target)
    ;(preds.get(e.target) ?? preds.set(e.target, []).get(e.target)!).push(e.source)
  }

  // Longest-path depth = column index.
  const depth = new Map<string, number>()
  nodes.forEach((n) => depth.set(n.id, 0))
  const q = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id)
  const work = new Map(indeg)
  while (q.length) {
    const u = q.shift()!
    for (const v of adj.get(u) ?? []) {
      depth.set(v, Math.max(depth.get(v) ?? 0, (depth.get(u) ?? 0) + 1))
      work.set(v, (work.get(v) ?? 0) - 1)
      if ((work.get(v) ?? 0) === 0) q.push(v)
    }
  }

  // Group by column, preserving original order as the seed.
  const byCol = new Map<number, string[]>()
  nodes.forEach((n) => {
    const d = depth.get(n.id) ?? 0
    ;(byCol.get(d) ?? byCol.set(d, []).get(d)!).push(n.id)
  })
  const cols = [...byCol.keys()].sort((a, b) => a - b)

  // Barycenter: order each column by the mean row of its predecessors.
  const order = new Map<string, number>()
  for (const d of cols) {
    const col = byCol.get(d)!
    if (d !== cols[0]) {
      col.sort((a, b) => bary(a) - bary(b))
    }
    col.forEach((id, i) => order.set(id, i))
  }
  function bary(id: string): number {
    const ps = preds.get(id) ?? []
    if (!ps.length) return order.get(id) ?? 0
    return ps.reduce((s, p) => s + (order.get(p) ?? 0), 0) / ps.length
  }

  // Center every column around a shared midline; stagger x a touch per row.
  const tallest = Math.max(1, ...cols.map((d) => byCol.get(d)!.length))
  const midY = ((tallest - 1) * V_GAP) / 2
  const pos = new Map<string, { x: number; y: number }>()
  for (const d of cols) {
    const col = byCol.get(d)!
    const colMid = ((col.length - 1) * V_GAP) / 2
    col.forEach((id, i) => {
      pos.set(id, {
        x: 80 + d * H_GAP + (i % 2 === 1 ? 46 : 0),
        y: 80 + midY - colMid + i * V_GAP,
      })
    })
  }

  return nodes.map((n) => ({ ...n, position: pos.get(n.id) ?? { x: 80, y: 80 } }))
}

export interface ParsedGraph {
  nodes: FtNode[]
  edges: Edge[]
  nodeCount: number
  edgeCount: number
}

/** Convert an LLM reply into a ready-to-load graph, or null if none/invalid. */
export function parseGraph(text: string): ParsedGraph | null {
  const raw = extractGraphJson(text)
  if (!raw?.nodes) return null

  const seen = new Set<string>()
  const nodes: FtNode[] = []
  for (const r of raw.nodes as Array<Record<string, unknown>>) {
    const kind = r.kind as NodeKind
    const id = typeof r.id === 'string' ? r.id : ''
    if (!id || seen.has(id) || !ALL_KINDS.includes(kind)) continue
    seen.add(id)
    const spec = getSpec(kind)
    const cfg = (r.config && typeof r.config === 'object' ? (r.config as Record<string, unknown>) : {}) || {}
    const label = typeof r.label === 'string' && r.label.trim() ? r.label : spec.label
    const config: Record<string, unknown> = { ...spec.defaultConfig, ...cfg }
    // Make custom agents fun: ensure a distinct color + a role-fitting icon even
    // if the model omitted them. Semantic nodes (file/warehouse/forge…) keep theirs.
    if (kind === 'custom') {
      if (typeof config.color !== 'string' || !config.color) {
        config.color = FUN_PALETTE[nodes.length % FUN_PALETTE.length]
      }
      if (typeof config.symbol !== 'string' || !config.symbol) {
        const g = guessSymbol(label)
        if (g) config.symbol = g
      }
    }
    nodes.push({ id, type: spec.reactFlowType, position: { x: 0, y: 0 }, data: { kind, label, config } })
  }
  if (!nodes.length) return null

  const kindById = new Map(nodes.map((n) => [n.id, n.data.kind as NodeKind]))
  const edges: Edge[] = []
  const rawEdges = Array.isArray(raw.edges) ? (raw.edges as Array<Record<string, unknown>>) : []
  rawEdges.forEach((e, i) => {
    const from = String(e.from ?? '')
    const to = String(e.to ?? '')
    if (!seen.has(from) || !seen.has(to)) return
    const handles = resolveHandles(
      kindById.get(from)!,
      kindById.get(to)!,
      String(e.fromPort ?? ''),
      String(e.toPort ?? ''),
      !!e.feedback,
    )
    if (!handles) return
    edges.push({
      id: `e${i}-${from}-${to}`,
      source: from,
      target: to,
      ...handles,
      type: e.feedback ? 'feedback' : 'default',
      ...(e.feedback ? { data: { maxIterations: 3 } } : {}),
    })
  })

  return { nodes: layout(nodes, edges), edges, nodeCount: nodes.length, edgeCount: edges.length }
}
