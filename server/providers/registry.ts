import type { Provider } from './types'
import { claudeCodeProvider } from './claudeCode'
import { openrouterProvider } from './openrouter'

/** All registered providers. Codex / OpenAI / Anthropic-direct get added here. */
const PROVIDERS: Record<string, Provider> = {
  [claudeCodeProvider.id]: claudeCodeProvider,
  [openrouterProvider.id]: openrouterProvider,
}

export const DEFAULT_PROVIDER = 'claude-code'

export function getProvider(id?: string): Provider {
  return PROVIDERS[id ?? DEFAULT_PROVIDER] ?? PROVIDERS[DEFAULT_PROVIDER]
}

export function registerProvider(p: Provider) {
  PROVIDERS[p.id] = p
}

export function listProviders(): Provider[] {
  return Object.values(PROVIDERS)
}
