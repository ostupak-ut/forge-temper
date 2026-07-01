import { useSyncExternalStore } from 'react'
import { UK } from './i18n.uk'

/**
 * Tiny, dependency-free i18n. Keys ARE the English source strings, so a component
 * reads `const t = useT()` then `t('Save')` — English is the fallback when a key
 * is missing from the Ukrainian dictionary. One external store (mirrors theme.ts)
 * so every component re-renders on a language switch.
 */
export type Lang = 'uk' | 'en'

const KEY = 'ft.lang'

function read(): Lang {
  return localStorage.getItem(KEY) === 'en' ? 'en' : 'uk' // default Ukrainian (tester build)
}

let current: Lang = read()
const listeners = new Set<() => void>()

export function getLang(): Lang {
  return current
}

export function setLang(l: Lang) {
  current = l
  localStorage.setItem(KEY, l)
  document.documentElement.lang = l
  listeners.forEach((f) => f())
}

export function toggleLang() {
  setLang(current === 'uk' ? 'en' : 'uk')
}

export function subscribeLang(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Translate an English source string to the active language (fallback: English). */
export function translate(en: string): string {
  return current === 'uk' ? UK[en] ?? en : en
}

/** Hook: subscribes to language changes and returns the translate fn. */
export function useT(): (en: string) => string {
  useSyncExternalStore(subscribeLang, getLang)
  return translate
}

/** Hook: the active language (for the toggle button label, etc.). */
export function useLang(): Lang {
  return useSyncExternalStore(subscribeLang, getLang)
}

// Set <html lang> on load for accessibility.
document.documentElement.lang = current
