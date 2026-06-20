import { z } from 'zod'

/** Output of a prose node (Body / Literature) — a LaTeX fragment + citations. */
export const ProseOutput = z.object({
  section: z.string().describe('e.g. "body", "literature"'),
  latex: z.string(),
  cite_keys: z.array(z.string()).default([]),
  new_bib_entries: z
    .array(z.string())
    .default([])
    .describe('raw BibTeX entries proposed by the node (flagged for review)'),
})
export type ProseOutput = z.infer<typeof ProseOutput>
