import type { Provider } from './types'
import { runHarness } from '../run/harnessRunner'

/**
 * Anthropic Harness: runs the agentic forge/temper/custom loop against a plain
 * Anthropic API key — no Claude CLI, no local agent SDK. Registers as an agent
 * so runs.ts writes the .skill-<name>.md file into cwd, which the harness's own
 * Read tool consumes.
 */
export const anthropicHarnessProvider: Provider = {
  id: 'anthropic-harness',
  label: 'Anthropic Harness (API key, no CLI)',
  kind: 'agent',
  supportsSkills: true,
  run: (p) => runHarness({ ...p, vendor: 'anthropic' }),
}
