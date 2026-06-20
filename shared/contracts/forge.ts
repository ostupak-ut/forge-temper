import { z } from 'zod'
import { ClaimType, DiscLetter, Relation } from './common'

/**
 * One step of an algebraic derivation, expressed so a CAS can check it.
 * The check is: does `relation` hold between the normalized `lhs` and `rhs`
 * over `over_domain`?  (e.g. simplify(lhs - rhs) == 0 for an equality.)
 */
export const DerivationStep = z.object({
  index: z.number().int().nonnegative(),
  lhs: z.string().describe('SymPy-parseable expression (no LaTeX macros)'),
  rhs: z.string().describe('SymPy-parseable expression'),
  relation: Relation.default('eq'),
  justification: z.string().optional(),
})
export type DerivationStep = z.infer<typeof DerivationStep>

/** Concrete numeric probe points proposed for a result. */
export const VerificationPlan = z.object({
  numeric_test_points: z
    .array(z.record(z.string(), z.number()))
    .default([])
    .describe('symbol -> value assignments to spot-check'),
  notes: z.string().optional(),
})
export type VerificationPlan = z.infer<typeof VerificationPlan>

/** A single building-block result in the prototype's spine. */
export const ResultSkeleton = z.object({
  id: z.string(),
  label: z.string().describe('e.g. "Proposition 1", "Lemma 2"'),
  kind: ClaimType,
  statement: z.string(),
  free_symbols: z.array(z.string()).default([]),
  over_domain: z
    .array(z.string())
    .default([])
    .describe('SymPy-parseable constraints scoping the claim'),
  derivation_steps: z.array(DerivationStep).default([]),
  proof_sketch: z.string().optional(),
  disc: DiscLetter.default('h'),
  verification_plan: VerificationPlan.default({ numeric_test_points: [] }),
  depends_on: z.array(z.string()).default([]),
})
export type ResultSkeleton = z.infer<typeof ResultSkeleton>

/**
 * Forge's structured output for one run: a paper version plus the
 * machine-checkable results skeleton Temper will verify.  The heavy artifacts
 * (LaTeX, PDF, sympy checks) live on disk in `proto_dir`; this carries the
 * spine + pointers.
 */
export const ForgeOutput = z.object({
  paper_id: z.string().optional().describe('forge-NNN-slug from the registry'),
  proto_dir: z.string().optional().describe('absolute path to the proto/ directory'),
  paper_version: z.string().describe('path to main .tex or a short summary'),
  pdf_path: z.string().optional(),
  rarity: z.number().min(0).max(5).optional(),
  tier_name: z.string().optional(),
  results_skeleton: z.array(ResultSkeleton).default([]),
})
export type ForgeOutput = z.infer<typeof ForgeOutput>
