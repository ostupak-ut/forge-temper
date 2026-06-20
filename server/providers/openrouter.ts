import type { Provider } from './types'
import { runOpenRouter } from '../run/openrouterRunner'

/** OpenRouter: one key → 400+ chat models. Plain inference (no skills/tools). */
export const openrouterProvider: Provider = {
  id: 'openrouter',
  label: 'OpenRouter',
  kind: 'chat',
  supportsSkills: false,
  run: runOpenRouter,
}
