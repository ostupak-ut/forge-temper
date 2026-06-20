import type { PortType } from '@shared/contracts'

/** Disc/port colors for handle styling. */
export const PORT_COLOR: Record<PortType, string> = {
  idea: '#8b5cf6',
  card: '#a855f7',
  paper: '#e8743b',
  report: '#3b9ae8',
  verified: '#22c55e',
  section: '#eab308',
  bib: '#14b8a6',
  file: '#94a3b8',
  control: '#f43f5e',
  any: '#cbd5e1',
}

/**
 * A connection is valid when the source output type can feed the target input.
 * Exact match by default; `verified` (a passed ForgeOutput) may also feed
 * anything that accepts a raw `paper`.
 */
const EXTRA_COMPATIBLE: Partial<Record<PortType, PortType[]>> = {
  verified: ['paper'],
}

export function arePortsCompatible(source: PortType, target: PortType): boolean {
  if (source === target) return true
  // The Custom Agent node's universal `any` port wires to/from anything.
  if (source === 'any' || target === 'any') return true
  return EXTRA_COMPATIBLE[source]?.includes(target) ?? false
}

/** Encode a port's type into its handle id, e.g. "out:paper" / "in:card". */
export function handleId(dir: 'in' | 'out', portId: string): string {
  return `${dir}:${portId}`
}
