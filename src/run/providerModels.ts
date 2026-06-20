export interface ModelInfo {
  id: string
  name: string
  prompt?: string
  completion?: string
}

const cache = new Map<string, ModelInfo[]>()

/** Fetch (and cache) a provider's model list from the backend proxy. */
export async function fetchModels(provider: string): Promise<ModelInfo[]> {
  if (cache.has(provider)) return cache.get(provider)!
  try {
    const r = await fetch(`/api/providers/${provider}/models`)
    const j = await r.json()
    const models: ModelInfo[] = j.models ?? []
    cache.set(provider, models)
    return models
  } catch {
    return []
  }
}
