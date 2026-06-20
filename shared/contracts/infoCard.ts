import { z } from 'zod'
import { ClaimType, Field } from './common'

/** A symbol in the paper's notation table. */
export const Notation = z.object({
  symbol: z.string(),
  type: z.string().describe('e.g. "real parameter", "strategy profile", "function"'),
  domain: z.string().optional().describe('SymPy-parseable constraint, e.g. "0 < beta < 1"'),
})
export type Notation = z.infer<typeof Notation>

/** A modelling assumption, with optional machine-checkable constraints. */
export const Assumption = z.object({
  id: z.string(),
  statement: z.string(),
  formal_constraints: z
    .array(z.string())
    .default([])
    .describe('SymPy-parseable, e.g. ["0 < beta < 1", "n >= 2"]'),
})
export type Assumption = z.infer<typeof Assumption>

/** A result the author wants Forge to establish. */
export const TargetResult = z.object({
  id: z.string(),
  kind: ClaimType,
  informal_claim: z.string(),
  depends_on: z.array(z.string()).default([]),
})
export type TargetResult = z.infer<typeof TargetResult>

/**
 * The "pokemon card" front-matter spec that seeds Forge. A dedicated source
 * node so it is reusable and inspectable, separate from Forge's own config.
 */
export const InfoCard = z.object({
  title: z.string().default(''),
  abstract: z.string().default(''),
  field: Field.default('econ'),
  contributions: z.array(z.string()).default([]),
  notation: z.array(Notation).default([]),
  assumptions: z.array(Assumption).default([]),
  model_setup: z
    .object({
      players: z.string().default(''),
      action_spaces: z.string().default(''),
      payoffs: z.string().default(''),
      timing: z.string().default(''),
      equilibrium_concept: z.string().default(''),
    })
    .default({
      players: '',
      action_spaces: '',
      payoffs: '',
      timing: '',
      equilibrium_concept: '',
    }),
  target_results: z.array(TargetResult).default([]),
})
export type InfoCard = z.infer<typeof InfoCard>
