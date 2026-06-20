import type { FastifyInstance } from 'fastify'
import { getKey, keyPresence, setKeys, type ProviderKey } from '../persistence/settingsStore'

export async function settingsRoutes(app: FastifyInstance) {
  // Presence booleans only — never return secret values.
  app.get('/api/settings', async () => ({ keys: keyPresence() }))

  app.post('/api/settings', async (req) => {
    const body = (req.body ?? {}) as Partial<Record<ProviderKey, string>>
    setKeys(body)
    return { ok: true, keys: keyPresence() }
  })

  // Server-side proxy for a provider's model list (keeps key server-side).
  let cache: { ts: number; models: unknown[] } | null = null
  app.get('/api/providers/:id/models', async (req) => {
    const { id } = req.params as { id: string }
    if (id !== 'openrouter') return { models: [] }
    const now = Date.now()
    if (cache && now - cache.ts < 24 * 3600 * 1000) return { models: cache.models }
    try {
      const headers: Record<string, string> = {}
      const key = getKey('openrouter')
      if (key) headers.Authorization = `Bearer ${key}`
      const res = await fetch('https://openrouter.ai/api/v1/models', { headers })
      const j = (await res.json()) as { data?: Array<{ id: string; name?: string; pricing?: { prompt?: string; completion?: string } }> }
      const models = (j.data ?? []).map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        prompt: m.pricing?.prompt,
        completion: m.pricing?.completion,
      }))
      cache = { ts: now, models }
      return { models }
    } catch (e) {
      return { models: cache?.models ?? [], error: String(e) }
    }
  })
}
