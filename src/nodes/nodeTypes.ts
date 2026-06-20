import type { NodeTypes } from '@xyflow/react'
import { GenericNode } from './GenericNode'
import { GroupNode } from './GroupNode'

/** Module-level (stable) map — both standard nodes and the loop container. */
export const nodeTypes: NodeTypes = {
  ftNode: GenericNode,
  ftGroup: GroupNode,
}
