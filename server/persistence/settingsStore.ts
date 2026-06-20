import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DATA_DIR } from '../config'

export type ProviderKey = 'openrouter' | 'openai' | 'anthropic'

const FILE = path.join(DATA_DIR, 'settings.json')
const ENV_VAR: Record<ProviderKey, string> = {
  openrouter: 'OPENROUTER_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
}

mkdirSync(DATA_DIR, { recursive: true })

let keys: Partial<Record<ProviderKey, string>> = {}

function load() {
  if (existsSync(FILE)) {
    try {
      keys = JSON.parse(readFileSync(FILE, 'utf8')).providerKeys ?? {}
    } catch {
      keys = {}
    }
  }
  // Merge into env so spawned children + fetch() inherit them.
  for (const p of Object.keys(ENV_VAR) as ProviderKey[]) {
    if (keys[p]) process.env[ENV_VAR[p]] = keys[p]
  }
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
  writeFileSync(FILE, JSON.stringify({ providerKeys: keys }, null, 2), { mode: 0o600 })
}

/** Presence booleans only — never expose secret values to the client. */
export function keyPresence(): Record<ProviderKey, boolean> {
  return { openrouter: hasKey('openrouter'), openai: hasKey('openai'), anthropic: hasKey('anthropic') }
}
