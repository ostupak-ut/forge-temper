import { z } from 'zod'

/**
 * Confidence disc — forge/temper's verification status axis.
 *   v = Verified (green): complete symbolic proof OR numeric confirmation
 *   p = Plausible (blue): key step symbolically checked; rest sketched
 *   h = Heuristic (orange): intuition/analogy only
 *   c = Conjectured (red): believed; no argument yet
 */
export const DiscLetter = z.enum(['v', 'p', 'h', 'c'])
export type DiscLetter = z.infer<typeof DiscLetter>

export const DISC_WORD: Record<DiscLetter, string> = {
  v: 'Verified',
  p: 'Plausible',
  h: 'Heuristic',
  c: 'Conjectured',
}
export const DISC_COLOR: Record<DiscLetter, string> = {
  v: '#22c55e',
  p: '#3b82f6',
  h: '#f59e0b',
  c: '#ef4444',
}

/** Tier a verifier module can earn for a result/step. */
export const VerifierTier = z.enum(['proof', 'evidence', 'unverifiable'])
export type VerifierTier = z.infer<typeof VerifierTier>

/** What kind of mathematical claim a result makes (drives the checking strategy). */
export const ClaimType = z.enum([
  'equality',
  'inequality',
  'equilibrium',
  'existence',
  'limit',
  'monotonicity',
  'other',
])
export type ClaimType = z.infer<typeof ClaimType>

/** Relation in a single derivation step. */
export const Relation = z.enum(['eq', 'le', 'lt', 'ge', 'gt', 'ne'])
export type Relation = z.infer<typeof Relation>

/** Academic field flag forge sets (calibrates rarity ladder + checking). */
export const Field = z.enum(['econ', 'OR', 'IS'])
export type Field = z.infer<typeof Field>

/**
 * Typed ports. Connection validity is decided by matching these:
 *   card     — InfoCard spec ("pokemon card") seeding Forge
 *   paper    — ForgeOutput (paper version + results skeleton)
 *   report   — TemperVerdict
 *   verified — a ForgeOutput the loop has marked all_correct
 *   section  — ProseOutput (a LaTeX fragment)
 *   bib      — bibliography entries
 *   file     — a file/folder staged into inputs/
 *   control  — execution/loop control signal
 */
export const PortType = z.enum([
  'idea',
  'card',
  'paper',
  'report',
  'verified',
  'section',
  'bib',
  'file',
  'control',
])
export type PortType = z.infer<typeof PortType>

/** Distribution of confidence discs over a prototype's results. */
export const DiscDistribution = z.object({
  v: z.number().int().nonnegative().default(0),
  p: z.number().int().nonnegative().default(0),
  h: z.number().int().nonnegative().default(0),
  c: z.number().int().nonnegative().default(0),
})
export type DiscDistribution = z.infer<typeof DiscDistribution>

/** Runtime status of a node within a run. */
export const NodeRunStatus = z.enum([
  'idle',
  'queued',
  'running',
  'done',
  'error',
  'skipped',
])
export type NodeRunStatus = z.infer<typeof NodeRunStatus>
