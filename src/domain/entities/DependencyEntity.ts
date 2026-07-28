import type {
  DependencyEntityID,
  ID,
  Index,
  GoalID,
} from "../value-objects/types"

interface DependencyEntityNode {
  data: ID
  title: string
  parent: Index[] | null //In case that node is a root node, parent is null
  children: Index[] | null // In case that node is a leaf node, children is null
}
//Root node is always the 'Goal' entity, the first item in the tree array.
interface DependencyEntity {
  id: DependencyEntityID
  belongTo: GoalID
  tree: DependencyEntityNode[]
}

export type { DependencyEntity, DependencyEntityNode }
