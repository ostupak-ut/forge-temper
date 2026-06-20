import { z } from 'zod'
import { DiscDistribution, DiscLetter, VerifierTier } from './common'

/** Verdict for a single derivation step. */
export const StepVerdict = z.object({
  step_index: z.number().int().nonnegative(),
  tier: VerifierTier,
  pass: z.boolean(),
  detail: z.string().optional(),
})
export type StepVerdict = z.infer<typeof StepVerdict>

/**
 * Verdict for one result. `tier`/`pass`/`earned_disc` are derived from the
 * verifier MODULE's deterministic output, not asserted by the model.
 */
export const ResultVerdict = z.object({
  result_id: z.string(),
  tier: VerifierTier,
  pass: z.boolean(),
  earned_disc: DiscLetter,
  coverage: z.string().optional().describe('what was probed, e.g. "20000 random + boundary"'),
  counterexample: z
    .record(z.string(), z.union([z.number(), z.string()]))
    .optional()
    .describe('breaking instance: symbol -> value'),
  diagnosis: z.string().optional(),
  suggested_fixes: z.array(z.string()).default([]),
  steps: z.array(StepVerdict).default([]),
})
export type ResultVerdict = z.infer<typeof ResultVerdict>

/**
 * Temper's structured output. `all_correct` is the loop's stop signal and is
 * ENGINE-DERIVED (every required result passed at proof/evidence tier).
 */
export const TemperVerdict = z.object({
  results: z.array(ResultVerdict).default([]),
  all_correct: z.boolean(),
  before: DiscDistribution.optional(),
  after: DiscDistribution.optional(),
  report_path: z.string().optional().describe('path to proto/temper-report.md'),
  feedback_for_forge: z
    .string()
    .optional()
    .describe('concise prose handed back to Forge on the next loop iteration'),
})
export type TemperVerdict = z.infer<typeof TemperVerdict>
