import type { Provider } from './types'
import { claudeCodeProvider } from './claudeCode'
import { codexProvider } from './codex'
import { openrouterProvider } from './openrouter'
import { anthropicHarnessProvider } from './anthropicHarness'
import { openrouterAgentProvider } from './openrouterAgent'
import { openrouterImageProvider } from './openrouterImage'
import { openrouterVideoProvider } from './openrouterVideo'

/** All registered providers. OpenAI-direct / Anthropic-direct get added here. */
const PROVIDERS: Record<string, Provider> = {
  [claudeCodeProvider.id]: claudeCodeProvider,
  [codexProvider.id]: codexProvider,
  [openrouterProvider.id]: openrouterProvider,
  [anthropicHarnessProvider.id]: anthropicHarnessProvider,
  [openrouterAgentProvider.id]: openrouterAgentProvider,
  [openrouterImageProvider.id]: openrouterImageProvider,
  [openrouterVideoProvider.id]: openrouterVideoProvider,
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
