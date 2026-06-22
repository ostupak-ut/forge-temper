import type { NodeTypes } from '@xyflow/react'
import { GenericNode } from './GenericNode'
import { FileNode } from './FileNode'
import { WarehouseNode } from './WarehouseNode'
import { IdeaNode } from './IdeaNode'

/**
 * Module-level (stable) map. `ftGroup` is aliased to GenericNode for backward
 * compatibility — legacy graphs may still carry container nodes; they render as
 * a plain (Unknown) node rather than tripping React Flow's missing-type fallback.
 * `ftFile` / `ftWarehouse` render as browsable file/folder cards; `ftIdea` is the
 * inline-editable sticky Prompt note.
 */
export const nodeTypes: NodeTypes = {
  ftNode: GenericNode,
  ftGroup: GenericNode,
  ftFile: FileNode,
  ftWarehouse: WarehouseNode,
  ftIdea: IdeaNode,
}
