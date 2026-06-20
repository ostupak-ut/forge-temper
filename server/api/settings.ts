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

  // Server-side proxy for OpenRouter's model list (public endpoint; key optional).
  // Both the chat ('openrouter') and agent ('openrouter-agent') providers use it;
  // the agent variant lists only TOOL-CAPABLE models (it drives a tool-use loop).
  type ORModel = { id: string; name: string; prompt?: string; completion?: string; tools: boolean }
  let cache: { ts: number; models: ORModel[] } | null = null
  app.get('/api/providers/:id/models', async (req) => {
    const { id } = req.params as { id: string }
    if (id !== 'openrouter' && id !== 'openrouter-agent') return { models: [] }
    const toolsOnly = id === 'openrouter-agent'
    const now = Date.now()
    if (!cache || now - cache.ts >= 24 * 3600 * 1000) {
      try {
        const headers: Record<string, string> = {}
        const key = getKey('openrouter')
        if (key) headers.Authorization = `Bearer ${key}`
        const res = await fetch('https://openrouter.ai/api/v1/models', { headers })
        const j = (await res.json()) as {
          data?: Array<{
            id: string
            name?: string
            pricing?: { prompt?: string; completion?: string }
            supported_parameters?: string[]
          }>
        }
        const models: ORModel[] = (j.data ?? []).map((m) => ({
          id: m.id,
          name: m.name ?? m.id,
          prompt: m.pricing?.prompt,
          completion: m.pricing?.completion,
          tools: (m.supported_parameters ?? []).includes('tools'),
        }))
        cache = { ts: now, models }
      } catch (e) {
        return { models: (cache?.models ?? []).filter((m) => !toolsOnly || m.tools), error: String(e) }
      }
    }
    return { models: cache.models.filter((m) => !toolsOnly || m.tools) }
  })
}
