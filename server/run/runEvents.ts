import { EventEmitter } from 'node:events'
import type { RunEvent } from '@shared/contracts'

interface RunBus {
  emitter: EventEmitter
  events: RunEvent[]
  ac: AbortController
  done: boolean
}

const buses = new Map<string, RunBus>()

export function createBus(runId: string): RunBus {
  const bus: RunBus = { emitter: new EventEmitter(), events: [], ac: new AbortController(), done: false }
  bus.emitter.setMaxListeners(0)
  buses.set(runId, bus)
  return bus
}

export function getBus(runId: string): RunBus | undefined {
  return buses.get(runId)
}

/** Append + fan out a run event (buffered so a late SSE subscriber still sees it). */
export function emitEvent(runId: string, ev: RunEvent): void {
  const bus = buses.get(runId)
  if (!bus) return
  bus.events.push(ev)
  bus.emitter.emit('ev', ev)
}

export function endBus(runId: string): void {
  const bus = buses.get(runId)
  if (!bus) return
  bus.done = true
  bus.emitter.emit('end')
  // keep briefly so a reconnecting client can drain the buffer
  setTimeout(() => buses.delete(runId), 30_000)
}
