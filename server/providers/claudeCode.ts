import type { Provider } from './types'
import { runNode } from '../run/claudeRunner'

/** The Claude Code provider: agentic, loads the user's skills (forge/temper/olehwrites). */
export const claudeCodeProvider: Provider = {
  id: 'claude-code',
  label: 'Claude Code (skills)',
  kind: 'agent',
  supportsSkills: true,
  run: (params) => runNode(params),
}
