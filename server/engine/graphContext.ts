import type { GraphEdge, GraphNode } from './runOneNode'

/**
 * Auto-generated "where am I" context injected into every agent's system prompt,
 * so a node isn't a blind organism — it knows its place in the pipeline, what it
 * consumes, what it feeds, and the overall flow. Works for built-in and custom
 * agents alike.
 *
 * The wording is user-editable: Settings → "Agent self-awareness" stores a
 * template with a `{{graph}}` placeholder where the auto-generated structural map
 * is spliced in. `buildGraphContext` renders that template; the toggle there can
 * turn the whole injection off.
 */

const AGENT_PURPOSE: Record<string, string> = {
  forge:
    'drafts a lean LaTeX→PDF prototype — building blocks, a results spine with confidence discs (verified/plausible/heuristic/conjectured), and a verification.md handoff.',
  temper:
    'numerically stress-tests the prototype’s results (random instances + counterexample hunts) and updates the confidence discs to their earned values.',
  body: 'writes the model/results prose exposition around the VERIFIED theorems.',
  literature: 'writes the related-work / literature-review section and manages the bibliography.',
  assemble: 'assembles preamble + body + verified theorems + bibliography into a compilable main.tex → PDF.',
  custom: 'a user-defined custom agent (its task is set by its own prompt below).',
}

/** Default, user-overridable wrapper. `{{graph}}` = the auto structural map. */
export const DEFAULT_GRAPH_TEMPLATE = `## Your place in the pipeline
{{graph}}

Act so your output is exactly what the downstream steps need, and stay consistent with what the upstream steps produced. Do only YOUR step — the others handle theirs.`

const isFeedback = (e: GraphEdge): boolean => e.type === 'feedback' || Boolean(e.data?.loopBackEdge)

/** The dynamic structural map only (no heading / instructions) — fills {{graph}}. */
function buildGraphMap(node: GraphNode, nodes: GraphNode[], edges: GraphEdge[]): { map: string; feedsWarehouse: boolean } {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const label = (id: string) => byId.get(id)?.data.label ?? id
  const kind = (id: string) => byId.get(id)?.data.kind ?? '?'
  const named = (id: string) => `${label(id)} (${kind(id)})`

  const fwd = edges.filter((e) => !isFeedback(e))
  const incoming = fwd.filter((e) => e.target === node.id).map((e) => named(e.source))
  const outgoing = fwd.filter((e) => e.source === node.id).map((e) => named(e.target))
  const feedsWarehouse = fwd.some((e) => e.source === node.id && byId.get(e.target)?.data.kind === 'warehouse')
  const flow = fwd.map((e) => `  ${label(e.source)} → ${label(e.target)}`)
  const loops = edges
    .filter(isFeedback)
    .map((e) => `  ${label(e.source)} ⟲ ${label(e.target)}  (loop: ${label(e.source)}’s verdict re-runs ${label(e.target)} until it passes or hits the cap)`)

  const purpose = AGENT_PURPOSE[node.data.kind] ?? ''
  const lines: string[] = []
  lines.push(`You are **${node.data.label}** — the \`${node.data.kind}\` step${purpose ? `, which ${purpose}` : '.'}`)
  if (incoming.length) lines.push(`Inputs you receive: ${incoming.join(', ')}.`)
  if (outgoing.length) lines.push(`Your output feeds: ${outgoing.join(', ')}.`)
  else lines.push('Your output is a terminal result of this graph.')
  if (flow.length || loops.length) {
    lines.push('')
    lines.push('The whole graph (forward edges):')
    lines.push(...flow)
    if (loops.length) {
      lines.push('Loops:')
      lines.push(...loops)
    }
  }
  return { map: lines.join('\n'), feedsWarehouse }
}

export function buildGraphContext(
  node: GraphNode,
  nodes: GraphNode[],
  edges: GraphEdge[],
  opts: { enabled?: boolean; template?: string } = {},
): string {
  if (opts.enabled === false) return ''
  const { map, feedsWarehouse } = buildGraphMap(node, nodes, edges)
  const tpl = opts.template && opts.template.trim() ? opts.template : DEFAULT_GRAPH_TEMPLATE
  let out = tpl.includes('{{graph}}') ? tpl.replace('{{graph}}', map) : `${tpl}\n\n${map}`
  if (feedsWarehouse) {
    out +=
      '\n\nIMPORTANT: a Warehouse downstream COLLECTS your results from disk. SAVE your output artifact(s) as real files in your current working directory (e.g. actually write/compile the .pdf, .md, or .tex) — do NOT just describe them in your reply, or nothing will be collected.'
  }
  return out
}
