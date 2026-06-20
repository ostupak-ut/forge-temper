import type { NodeTypes } from '@xyflow/react'
import { GenericNode } from './GenericNode'

/** Module-level (stable) map — every node renders via GenericNode now. */
export const nodeTypes: NodeTypes = {
  ftNode: GenericNode,
}
