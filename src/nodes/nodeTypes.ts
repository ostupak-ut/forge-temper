import type { NodeTypes } from '@xyflow/react'
import { GenericNode } from './GenericNode'

/**
 * Module-level (stable) map. `ftGroup` is aliased to GenericNode for backward
 * compatibility — legacy graphs may still carry container nodes; they render as
 * a plain (Unknown) node rather than tripping React Flow's missing-type fallback.
 */
export const nodeTypes: NodeTypes = {
  ftNode: GenericNode,
  ftGroup: GenericNode,
}
