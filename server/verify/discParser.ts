import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { DiscTally } from '@shared/contracts'

/**
 * Phase 3 verifier (artifact-based): forge/temper already do the symbolic
 * (sympy) and numeric (numpy) work and stamp each result with a confidence
 * disc `[v|p|h|c]` on its theorem environment. We DERIVE the verdict by
 * counting those deterministic tokens in the compiled .tex — the computation
 * happened in forge's checks/ and temper's verify.py, not in model prose.
 */

const RESULT_ENVS = 'theorem|proposition|lemma|corollary|claim|definition|remark|assumption'
// e.g. \begin{proposition}[v]
const ENV_DISC_RE = new RegExp(`\\\\begin\\{(?:${RESULT_ENVS})\\}\\[([vphc])\\]`, 'g')

export interface ProtoVerdict {
  distribution: DiscTally
  results: number
  allCorrect: boolean
  reportExcerpt?: string
}

const SKIP_TEX = new Set(['skeleton.tex', 'preamble.tex', 'proofs.tex'])

async function findMainTex(protoDir: string): Promise<string | null> {
  try {
    const files = await readdir(protoDir)
    const tex = files.filter((f) => f.endsWith('.tex'))
    const main =
      tex.find((f) => /^forge-.*\.tex$/i.test(f)) ?? tex.find((f) => !SKIP_TEX.has(f.toLowerCase()))
    return main ? path.join(protoDir, main) : null
  } catch {
    return null
  }
}

/** Count the per-result discs in the prototype's main .tex → verdict. */
export async function verifyProtoDir(protoDir: string): Promise<ProtoVerdict | null> {
  const mainTex = await findMainTex(protoDir)
  if (!mainTex) return null
  const tex = await readFile(mainTex, 'utf8').catch(() => '')
  const dist: DiscTally = { v: 0, p: 0, h: 0, c: 0 }
  for (const m of tex.matchAll(ENV_DISC_RE)) {
    dist[m[1] as keyof DiscTally] += 1
  }
  const results = dist.v + dist.p + dist.h + dist.c
  if (results === 0) return null

  let reportExcerpt: string | undefined
  try {
    reportExcerpt = (await readFile(path.join(protoDir, 'temper-report.md'), 'utf8')).slice(0, 2000)
  } catch {
    /* report optional */
  }

  // "Correct" = every result reached Verified (green) or Plausible (blue);
  // no Heuristic (orange) or Conjectured (red) remains.
  const allCorrect = dist.h === 0 && dist.c === 0
  return { distribution: dist, results, allCorrect, reportExcerpt }
}
