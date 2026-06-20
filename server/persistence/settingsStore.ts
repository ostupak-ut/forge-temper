import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DATA_DIR, setWorkspaceDir } from '../config'

export type ProviderKey = 'openrouter' | 'openai' | 'anthropic'
export type CliName = 'codex' | 'claude'

const FILE = path.join(DATA_DIR, 'settings.json')
const ENV_VAR: Record<ProviderKey, string> = {
  openrouter: 'OPENROUTER_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
}

mkdirSync(DATA_DIR, { recursive: true })

let keys: Partial<Record<ProviderKey, string>> = {}
let workspaceDir: string | null = null
let cli: Partial<Record<CliName, string>> = {}
let graphAware = true
let graphTemplate: string | null = null

function persist() {
  writeFileSync(FILE, JSON.stringify({ providerKeys: keys, workspaceDir, cli, graphAware, graphTemplate }, null, 2), {
    mode: 0o600,
  })
}

function load() {
  if (existsSync(FILE)) {
    try {
      const j = JSON.parse(readFileSync(FILE, 'utf8'))
      keys = j.providerKeys ?? {}
      workspaceDir = typeof j.workspaceDir === 'string' && j.workspaceDir.trim() ? j.workspaceDir : null
      cli = j.cli && typeof j.cli === 'object' ? j.cli : {}
      graphAware = j.graphAware !== false
      graphTemplate = typeof j.graphTemplate === 'string' && j.graphTemplate.trim() ? j.graphTemplate : null
    } catch {
      keys = {}
      workspaceDir = null
      cli = {}
      graphAware = true
      graphTemplate = null
    }
  }
  // Merge into env so spawned children + fetch() inherit them.
  for (const p of Object.keys(ENV_VAR) as ProviderKey[]) {
    if (keys[p]) process.env[ENV_VAR[p]] = keys[p]
  }
  // Apply the persisted workspace override (mkdirs it via config).
  if (workspaceDir) setWorkspaceDir(workspaceDir)
}
load()

export function getKey(p: ProviderKey): string | undefined {
  return keys[p] ?? process.env[ENV_VAR[p]]
}

export function hasKey(p: ProviderKey): boolean {
  return !!getKey(p)
}

export function setKeys(partial: Partial<Record<ProviderKey, string>>) {
  for (const [k, v] of Object.entries(partial)) {
    const pk = k as ProviderKey
    if (typeof v === 'string' && v.trim()) {
      keys[pk] = v.trim()
      process.env[ENV_VAR[pk]] = v.trim()
    }
  }
  persist()
}

/** Presence booleans only — never expose secret values to the client. */
export function keyPresence(): Record<ProviderKey, boolean> {
  return { openrouter: hasKey('openrouter'), openai: hasKey('openai'), anthropic: hasKey('anthropic') }
}

/** The persisted workspace override, or null when running on the default root. */
export function getWorkspaceSetting(): string | null {
  return workspaceDir
}

/**
 * Persist a new workspace root (absolute path), apply it to config (which mkdirs
 * it), and write it to settings.json. Pass null/empty to revert to the default.
 */
export function setWorkspaceSetting(dir: string | null): void {
  const next = typeof dir === 'string' && dir.trim() ? path.resolve(dir.trim()) : null
  workspaceDir = next
  setWorkspaceDir(next)
  persist()
}

/** Overridden CLI binary path (codex/claude), or undefined to auto-detect. */
export function getCli(name: CliName): string | undefined {
  const v = cli[name]
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

export function getCliSettings(): Record<CliName, string> {
  return { codex: cli.codex ?? '', claude: cli.claude ?? '' }
}

/** Set/clear CLI path overrides. Empty string clears (back to auto-detect). */
export function setCliSettings(partial: Partial<Record<CliName, string>>): void {
  for (const [k, v] of Object.entries(partial)) {
    const name = k as CliName
    if (typeof v === 'string' && v.trim()) cli[name] = v.trim()
    else delete cli[name]
  }
  persist()
}

/** Whether the auto "where you are in the pipeline" context is injected. */
export function getGraphAware(): boolean {
  return graphAware
}

/** The user's custom self-awareness template, or null to use the built-in default. */
export function getGraphTemplate(): string | null {
  return graphTemplate
}

/** Update the self-awareness toggle and/or template. Empty template → default. */
export function setGraphSettings(p: { aware?: boolean; template?: string | null }): void {
  if (typeof p.aware === 'boolean') graphAware = p.aware
  if ('template' in p) graphTemplate = typeof p.template === 'string' && p.template.trim() ? p.template : null
  persist()
}
