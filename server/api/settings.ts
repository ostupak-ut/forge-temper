import type { FastifyInstance } from 'fastify'
import {
  getCliSettings,
  getGraphAware,
  getGraphTemplate,
  getKey,
  getWorkspaceSetting,
  keyPresence,
  setCliSettings,
  setGraphSettings,
  setKeys,
  setWorkspaceSetting,
  type CliName,
  type ProviderKey,
} from '../persistence/settingsStore'
import { DEFAULT_WORKSPACE_DIR, getWorkspaceDir } from '../config'
import { DEFAULT_GRAPH_TEMPLATE } from '../engine/graphContext'
import { listSkills } from '../skills/skillLoader'

export async function settingsRoutes(app: FastifyInstance) {
  // Available skills for the node Skill picker (~/.claude/skills + bundled).
  app.get('/api/skills', async () => ({ skills: listSkills() }))

  // Presence booleans only — never return secret values.
  app.get('/api/settings', async () => ({
    keys: keyPresence(),
    workspaceDir: getWorkspaceDir(),
    workspaceOverride: getWorkspaceSetting(),
    defaultWorkspaceDir: DEFAULT_WORKSPACE_DIR,
    cli: getCliSettings(),
    graphAware: getGraphAware(),
    graphTemplate: getGraphTemplate() ?? DEFAULT_GRAPH_TEMPLATE,
    defaultGraphTemplate: DEFAULT_GRAPH_TEMPLATE,
  }))

  app.post('/api/settings', async (req) => {
    const body = (req.body ?? {}) as Partial<Record<ProviderKey, string>> & {
      workspaceDir?: unknown
      cli?: Partial<Record<CliName, string>>
      graphAware?: unknown
      graphTemplate?: unknown
    }
    if ('workspaceDir' in body) {
      const wd = body.workspaceDir
      // Reject empty: clearing (revert to default) requires an explicit null.
      if (wd !== null && (typeof wd !== 'string' || !wd.trim())) {
        return { ok: false, error: 'workspaceDir must be a non-empty absolute path (or null to reset)' }
      }
      setWorkspaceSetting(wd === null ? null : (wd as string))
    }
    if (body.cli && typeof body.cli === 'object') setCliSettings(body.cli)
    if ('graphAware' in body || 'graphTemplate' in body) {
      setGraphSettings({
        ...(typeof body.graphAware === 'boolean' ? { aware: body.graphAware } : {}),
        ...('graphTemplate' in body
          ? { template: body.graphTemplate === null ? null : String(body.graphTemplate ?? '') }
          : {}),
      })
    }
    const { workspaceDir: _wd, cli: _cli, graphAware: _ga, graphTemplate: _gt, ...keyBody } = body
    setKeys(keyBody as Partial<Record<ProviderKey, string>>)
    return {
      ok: true,
      keys: keyPresence(),
      workspaceDir: getWorkspaceDir(),
      workspaceOverride: getWorkspaceSetting(),
      defaultWorkspaceDir: DEFAULT_WORKSPACE_DIR,
      cli: getCliSettings(),
      graphAware: getGraphAware(),
      graphTemplate: getGraphTemplate() ?? DEFAULT_GRAPH_TEMPLATE,
      defaultGraphTemplate: DEFAULT_GRAPH_TEMPLATE,
    }
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
