import type { GraphDoc } from './serialize'

export interface FlowMeta {
  name: string
  updatedAt: number
  size: number
}

export async function listFlows(): Promise<FlowMeta[]> {
  try {
    const r = await fetch('/api/flows')
    return (await r.json()).items ?? []
  } catch {
    return []
  }
}

export async function loadFlow(name: string): Promise<GraphDoc | null> {
  const r = await fetch(`/api/flows/${encodeURIComponent(name)}`)
  if (!r.ok) return null
  return r.json()
}

export async function saveFlow(name: string, doc: GraphDoc): Promise<boolean> {
  const r = await fetch(`/api/flows/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  })
  return r.ok
}

export async function deleteFlow(name: string): Promise<boolean> {
  const r = await fetch(`/api/flows/${encodeURIComponent(name)}`, { method: 'DELETE' })
  return r.ok
}
