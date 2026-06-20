/** App font preference — persisted, applied via the --app-font CSS variable. */
export type AppFont = 'system' | 'inter' | 'serif' | 'mono' | 'rounded'

const KEY = 'ft.font'

const STACKS: Record<AppFont, string> = {
  system: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  inter: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "Georgia, 'Iowan Old Style', 'Times New Roman', Times, serif",
  mono: "ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, Consolas, monospace",
  rounded: "'SF Pro Rounded', ui-rounded, 'Segoe UI', system-ui, sans-serif",
}

export const FONT_OPTIONS: { value: AppFont; label: string }[] = [
  { value: 'system', label: 'System (default)' },
  { value: 'inter', label: 'Inter' },
  { value: 'serif', label: 'Serif (FT-style)' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'mono', label: 'Monospace' },
]

function read(): AppFont {
  const v = localStorage.getItem(KEY)
  return v && v in STACKS ? (v as AppFont) : 'system'
}

let current: AppFont = read()
const listeners = new Set<() => void>()

export function applyFont(f: AppFont) {
  current = f
  document.documentElement.style.setProperty('--app-font', STACKS[f])
  localStorage.setItem(KEY, f)
  listeners.forEach((l) => l())
}

export function getFont(): AppFont {
  return current
}

export function setFont(f: AppFont) {
  applyFont(f)
}

export function subscribeFont(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// Apply on module load (imported from main.tsx before render).
applyFont(current)
