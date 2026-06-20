import { z } from 'zod'

/**
 * Loop control contract. The Forge↔Temper cycle is defined by the Temper→Forge
 * back-edge (a `feedback` edge into a `loopInternal` port). The edge's own `data`
 * carries this config (edited by clicking the arrow); a back-edge with no config
 * set falls back to the Zod defaults below (until-pass, max 3).
 */
export const LoopMode = z.enum(['until-count', 'until-pass'])
export type LoopMode = z.infer<typeof LoopMode>

export const LoopConfig = z.object({
  mode: LoopMode.default('until-pass'),
  /** Hard cap — always applies, even in until-pass mode. */
  maxIterations: z.number().int().min(1).max(20).default(3),
  approveEachIteration: z.boolean().default(false),
})
export type LoopConfig = z.infer<typeof LoopConfig>

/** One iteration's computed outcome (from verifyProtoDir over the disc tokens). */
export const LoopIteration = z.object({
  iteration: z.number().int().positive(),
  distribution: z.object({
    v: z.number().int().nonnegative(),
    p: z.number().int().nonnegative(),
    h: z.number().int().nonnegative(),
    c: z.number().int().nonnegative(),
  }),
  results: z.number().int().nonnegative(),
  allCorrect: z.boolean(),
  protoDir: z.string().optional(),
})
export type LoopIteration = z.infer<typeof LoopIteration>
