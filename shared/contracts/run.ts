import type { NodeRunStatus } from './common'

/** Confidence-disc tally over a prototype's results (computed from the .tex tokens). */
export interface DiscTally {
  v: number
  p: number
  h: number
  c: number
}

/** Events streamed (SSE) from a backend run to the frontend. */
export type RunEvent =
  | { type: 'status'; nodeId: string; status: NodeRunStatus; iteration?: number }
  | { type: 'token'; nodeId: string; text: string }
  | { type: 'tool'; nodeId: string; tool: string }
  | { type: 'result'; nodeId: string; ok: boolean; result?: string; costUsd?: number; sessionId?: string }
  | {
      type: 'verdict'
      nodeId: string
      distribution: DiscTally
      allCorrect: boolean
      results: number
      protoDir?: string
      iteration?: number
    }
  | {
      type: 'iteration'
      loopId: string
      nodeId: string
      iteration: number
      distribution: DiscTally
      results: number
      allCorrect: boolean
      protoDir?: string
    }
  | { type: 'loop-done'; loopId: string; converged: boolean; iterations: number; reason: string }
  | { type: 'error'; nodeId: string; error: string }
  | { type: 'run-done'; status: 'done' | 'error' | 'stopped' }

export interface StartRunRequest {
  mode: 'single' | 'graph'
  nodeId?: string
  graph: { nodes: unknown[]; edges: unknown[] }
}
