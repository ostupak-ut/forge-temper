import type { Provider } from './types'
import { runCodexNode } from '../run/codexRunner'

/**
 * The Codex provider: drives the local OpenAI `codex` CLI agentically via
 * `codex exec --json`. Auth = the user's ChatGPT/Codex subscription (no API
 * key). Like claude-code, it runs the forge/temper skills (delivered as a file).
 */
export const codexProvider: Provider = {
  id: 'codex',
  label: 'Codex (ChatGPT/Codex subscription, CLI)',
  kind: 'agent',
  supportsSkills: true,
  run: (params) => runCodexNode(params),
}
