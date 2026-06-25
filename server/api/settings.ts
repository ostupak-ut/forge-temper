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

  // Server-side proxy for OpenRouter's model lists (public endpoints; key optional).
  // Four categories share this route:
  //   openrouter        → chat/text models (image/video generators excluded — own categories)
  //   openrouter-agent  → TOOL-CAPABLE models only (drives a tool-use loop)
  //   openrouter-image  → image-output models (synchronous generation via chat completions)
  //   openrouter-video  → video models from the SEPARATE async /videos job API endpoint
  type ORModel = { id: string; name: string; prompt?: string; completion?: string; tools: boolean; output: string[] }
  let cache: { ts: number; models: ORModel[] } | null = null
  let vcache: { ts: number; models: ORModel[] } | null = null
  const DAY = 24 * 3600 * 1000
  const orHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {}
    const key = getKey('openrouter')
    if (key) headers.Authorization = `Bearer ${key}`
    return headers
  }

  // Chat/agent/image all derive from the standard /models list (cached together).
  async function loadChatModels(): Promise<ORModel[]> {
    if (cache && Date.now() - cache.ts < DAY) return cache.models
    const res = await fetch('https://openrouter.ai/api/v1/models', { headers: orHeaders() })
    const j = (await res.json()) as {
      data?: Array<{
        id: string
        name?: string
        pricing?: { prompt?: string; completion?: string }
        supported_parameters?: string[]
        architecture?: { output_modalities?: string[] }
      }>
    }
    const models: ORModel[] = (j.data ?? []).map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      prompt: m.pricing?.prompt,
      completion: m.pricing?.completion,
      tools: (m.supported_parameters ?? []).includes('tools'),
      output: m.architecture?.output_modalities ?? [],
    }))
    cache = { ts: Date.now(), models }
    return models
  }

  // Video models live under a different namespace (the async job API), so they
  // need their own fetch + cache — they never appear in /api/v1/models.
  async function loadVideoModels(): Promise<ORModel[]> {
    if (vcache && Date.now() - vcache.ts < DAY) return vcache.models
    const res = await fetch('https://openrouter.ai/api/v1/videos/models', { headers: orHeaders() })
    const j = (await res.json()) as {
      data?: Array<{ id: string; name?: string }>
      models?: Array<{ id: string; name?: string }>
    }
    const list = j.data ?? j.models ?? []
    const models: ORModel[] = list.map((m) => ({ id: m.id, name: m.name ?? m.id, tools: false, output: ['video'] }))
    vcache = { ts: Date.now(), models }
    return models
  }

  const isImageModel = (m: ORModel) => m.output.includes('image')
  const isVideoModel = (m: ORModel) => m.output.includes('video')

  app.get('/api/providers/:id/models', async (req) => {
    const { id } = req.params as { id: string }
    try {
      if (id === 'openrouter-video') return { models: await loadVideoModels() }
      if (id === 'openrouter' || id === 'openrouter-agent' || id === 'openrouter-image') {
        const all = await loadChatModels()
        if (id === 'openrouter-agent') return { models: all.filter((m) => m.tools) }
        if (id === 'openrouter-image') return { models: all.filter(isImageModel) }
        // plain chat: text models, excluding image/video generators (own categories)
        return { models: all.filter((m) => !isImageModel(m) && !isVideoModel(m)) }
      }
      return { models: [] }
    } catch (e) {
      // On a fetch failure, serve a stale cache scoped to the requested category.
      if (id === 'openrouter-video') return { models: vcache?.models ?? [], error: String(e) }
      const all = cache?.models ?? []
      if (id === 'openrouter-agent') return { models: all.filter((m) => m.tools), error: String(e) }
      if (id === 'openrouter-image') return { models: all.filter(isImageModel), error: String(e) }
      if (id === 'openrouter')
        return { models: all.filter((m) => !isImageModel(m) && !isVideoModel(m)), error: String(e) }
      return { models: [], error: String(e) }
    }
  })
}
