import type { ChatMsg } from './designApi'

// Per-workflow "Design with AI" chat history, persisted in localStorage so it
// survives reloads. Keyed by the current flow name (or a shared "unsaved" key).
const CHATS_KEY = 'ft.designChats'
const PREFS_KEY = 'ft.designPrefs'
const UNSAVED = '__unsaved__'

export const workflowKey = (flowName: string | null | undefined) => flowName?.trim() || UNSAVED

type ChatStore = Record<string, ChatMsg[]>

function readAll(): ChatStore {
  try {
    const v = JSON.parse(localStorage.getItem(CHATS_KEY) || '{}')
    return v && typeof v === 'object' ? (v as ChatStore) : {}
  } catch {
    return {}
  }
}

export function loadDesignChat(flowName: string | null): ChatMsg[] {
  const all = readAll()
  const msgs = all[workflowKey(flowName)]
  return Array.isArray(msgs) ? msgs : []
}

export function saveDesignChat(flowName: string | null, msgs: ChatMsg[]): void {
  const all = readAll()
  if (msgs.length) all[workflowKey(flowName)] = msgs
  else delete all[workflowKey(flowName)]
  try {
    localStorage.setItem(CHATS_KEY, JSON.stringify(all))
  } catch {
    /* quota — ignore */
  }
}

export function clearDesignChat(flowName: string | null): void {
  saveDesignChat(flowName, [])
}

export interface DesignPrefs {
  provider: string
  model: string
}

export function loadDesignPrefs(): Partial<DesignPrefs> {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveDesignPrefs(prefs: DesignPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}
