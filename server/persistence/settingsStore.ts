import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DATA_DIR, setWorkspaceDir } from '../config'

export type ProviderKey = 'openrouter' | 'openai' | 'anthropic'

const FILE = path.join(DATA_DIR, 'settings.json')
const ENV_VAR: Record<ProviderKey, string> = {
  openrouter: 'OPENROUTER_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
}

mkdirSync(DATA_DIR, { recursive: true })

let keys: Partial<Record<ProviderKey, string>> = {}
let workspaceDir: string | null = null

function persist() {
  writeFileSync(FILE, JSON.stringify({ providerKeys: keys, workspaceDir }, null, 2), { mode: 0o600 })
}

function load() {
  if (existsSync(FILE)) {
    try {
      const j = JSON.parse(readFileSync(FILE, 'utf8'))
      keys = j.providerKeys ?? {}
      workspaceDir = typeof j.workspaceDir === 'string' && j.workspaceDir.trim() ? j.workspaceDir : null
    } catch {
      keys = {}
      workspaceDir = null
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
