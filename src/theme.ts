export type Theme = 'dark' | 'light'

const KEY = 'ft.theme'

function read(): Theme {
  const v = localStorage.getItem(KEY)
  return v === 'light' ? 'light' : 'dark'
}

let current: Theme = read()
const listeners = new Set<() => void>()

export function applyTheme(t: Theme) {
  current = t
  document.documentElement.classList.toggle('light', t === 'light')
  localStorage.setItem(KEY, t)
  listeners.forEach((l) => l())
}

export function getTheme(): Theme {
  return current
}

export function toggleTheme() {
  applyTheme(current === 'dark' ? 'light' : 'dark')
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// Apply on module load so there's no flash of the wrong theme.
applyTheme(current)
