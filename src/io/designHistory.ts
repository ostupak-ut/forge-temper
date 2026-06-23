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

const trySet = (store: ChatStore): boolean => {
  try {
    localStorage.setItem(CHATS_KEY, JSON.stringify(store))
    return true
  } catch {
    return false
  }
}

export function saveDesignChat(flowName: string | null, msgs: ChatMsg[]): void {
  const key = workflowKey(flowName)
  const all = readAll()
  if (msgs.length) all[key] = msgs
  else delete all[key]
  if (trySet(all)) return

  // Over quota (chat content includes big graph JSON). Prune progressively so
  // saving KEEPS WORKING instead of silently failing: halve this workflow's
  // history, then drop other workflows, then keep just the last turns.
  let cur = msgs
  while (cur.length > 1) {
    cur = cur.slice(-Math.max(1, Math.floor(cur.length / 2)))
    all[key] = cur
    if (trySet(all)) return
  }
  if (trySet({ [key]: msgs.slice(-6) })) return
  trySet({ [key]: msgs.slice(-1) })
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
