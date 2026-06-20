import type { Provider } from './types'
import { runHarness } from '../run/harnessRunner'

/**
 * OpenRouter Agent: the same in-app agentic loop as the Anthropic harness, but
 * driven over OpenRouter's OpenAI-style chat-completions tool calling against
 * any tool-capable model. Registers as an agent so runs.ts writes the
 * .skill-<name>.md file the harness reads.
 */
export const openrouterAgentProvider: Provider = {
  id: 'openrouter-agent',
  label: 'OpenRouter Agent (tool-capable, no CLI)',
  kind: 'agent',
  supportsSkills: true,
  run: (p) => runHarness({ ...p, vendor: 'openrouter' }),
}
