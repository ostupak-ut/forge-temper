import { create } from 'zustand'

/** A saved Custom Agent (name + symbol + full config) reusable from the Palette. */
export interface CustomPreset {
  id: string
  name: string
  symbol?: string
  config: Record<string, unknown>
}

const KEY = 'ft.customPresets'

function load(): CustomPreset[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function persist(presets: CustomPreset[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(presets))
  } catch {
    /* ignore quota/availability */
  }
}

interface PresetState {
  presets: CustomPreset[]
  add: (p: Omit<CustomPreset, 'id'>) => void
  remove: (id: string) => void
}

/** localStorage-backed store of saved custom agents (survives reloads). */
export const usePresets = create<PresetState>((set, get) => ({
  presets: load(),
  add: (p) => {
    const id = globalThis.crypto?.randomUUID?.() ?? `preset-${Date.now()}`
    const next = [...get().presets, { ...p, id }]
    persist(next)
    set({ presets: next })
  },
  remove: (id) => {
    const next = get().presets.filter((x) => x.id !== id)
    persist(next)
    set({ presets: next })
  },
}))
