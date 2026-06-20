import type { Edge } from '@xyflow/react'
import type { FtNode } from '@/store/graphStore'

export const DOC_VERSION = 1
const AUTOSAVE_KEY = 'ft.autosave'

export interface GraphDoc {
  schemaVersion: number
  nodes: FtNode[]
  edges: Edge[]
}

export function serializeGraph(nodes: FtNode[], edges: Edge[]): GraphDoc {
  return { schemaVersion: DOC_VERSION, nodes, edges }
}

export function downloadGraph(doc: GraphDoc, name = 'graph.ftflow.json') {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function loadGraphFromFile(): Promise<GraphDoc | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      try {
        const doc = JSON.parse(await file.text()) as GraphDoc
        resolve(doc.schemaVersion ? doc : null)
      } catch {
        resolve(null)
      }
    }
    input.click()
  })
}

export function saveAutosave(doc: GraphDoc) {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(doc))
  } catch {
    /* ignore quota */
  }
}

export function loadAutosave(): GraphDoc | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    return raw ? (JSON.parse(raw) as GraphDoc) : null
  } catch {
    return null
  }
}
