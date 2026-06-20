import type { LucideIcon } from 'lucide-react'
import type { PortType } from '@shared/contracts'

/** Every node kind the editor knows about. */
export type NodeKind =
  | 'idea'
  | 'infocard'
  | 'file'
  | 'forge'
  | 'temper'
  | 'custom'
  | 'body'
  | 'literature'
  | 'assemble'
  | 'warehouse'

/** A typed input/output port on a node. */
export interface Port {
  id: string
  type: PortType
  label?: string
  required?: boolean
  /** Filled by the loop driver each iteration, not by a drawn edge. */
  loopInternal?: boolean
}

/** How a config field renders in the Inspector. */
export type FieldKind =
  | 'text'
  | 'textarea'
  | 'prompt'
  | 'number'
  | 'select'
  | 'boolean'
  | 'path'
  | 'model'
  | 'skill'
  | 'multiselect'
  | 'icon'
  | 'color'
  | 'files'
  | 'warehouse'

export interface FieldOption {
  label: string
  value: string
}

export interface FieldDescriptor {
  key: string
  label: string
  kind: FieldKind
  group?: string
  options?: FieldOption[]
  placeholder?: string
  help?: string
  min?: number
  max?: number
  step?: number
  rows?: number
  /** For 'path' fields: show a "Choose file…" button that uploads from the OS dialog. */
  pickFile?: boolean
}

export type NodeConfig = Record<string, unknown>

/**
 * Stored in `node.data`. Run-state is NOT here — it lives in the store's
 * runState map keyed by node id, so saved graphs stay execution-independent.
 * Index signature satisfies React Flow's `Record<string, unknown>` data bound.
 */
export interface FtNodeData {
  kind: NodeKind
  label: string
  config: NodeConfig
  [key: string]: unknown
}

export interface NodeSpec {
  kind: NodeKind
  label: string
  description: string
  color: string
  icon: LucideIcon
  inputs: Port[]
  outputs: Port[]
  fields: FieldDescriptor[]
  defaultConfig: NodeConfig
  /** Legacy: a resizable container (the old Loop zone). Retained as dead-but-legal. */
  isContainer?: boolean
  /** Which React Flow node component renders it. */
  reactFlowType: 'ftNode' | 'ftGroup'
  /**
   * Hide from the node Palette (still in the registry, so saved graphs render and
   * a Custom Agent can take on the same role via its skill picker). Used for the
   * built-in domain agents (forge/temper/body/literature) + the doc Info Card.
   */
  hidePalette?: boolean
}
