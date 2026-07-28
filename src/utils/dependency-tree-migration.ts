import type {
  DependencyEntity,
  DependencyEntityNode,
} from "@/domain/entities/DependencyEntity"
import type { ID, Index } from "@/domain/value-objects/types"

function cloneTree(tree: DependencyEntity["tree"]): DependencyEntityNode[] {
  return tree.map((node) => ({
    ...node,
    parent: node.parent ? [...node.parent] : null,
    children: node.children ? [...node.children] : null,
  }))
}

/**
 * Remove the task node from a dependency tree, re-indexing the remaining edges
 * and bridging the removed node's children up to ALL of its parents ("向上传递"):
 * every parent inherits every child, so the existing relationships are preserved
 * rather than dropped. Matches the removal logic in `deleteTask`.
 *
 * Returns the original tree unchanged when the node is not present.
 */
export function removeTaskNodeFromTree(
  tree: DependencyEntity["tree"],
  taskData: ID
): DependencyEntityNode[] {
  const nodeIndex = tree.findIndex((node) => node.data === taskData)
  if (nodeIndex === -1) {
    return cloneTree(tree)
  }

  const node = tree[nodeIndex]!
  const parentIndices = node.parent ?? []
  const childIndices = node.children ?? []

  // Deleting an array element shifts every later index down by one.
  const remap = (index: Index) => (index > nodeIndex ? index - 1 : index)

  const cloned = cloneTree(tree)

  const rebuilt = cloned.map((treeNode, index) => {
    if (index === nodeIndex) {
      return null
    }

    let parent = treeNode.parent
    if (parent) {
      const filtered = parent.filter((p) => p !== nodeIndex)
      const wasChild = parent.includes(nodeIndex)
      const merged = wasChild ? [...filtered, ...parentIndices] : filtered
      const remapped = [...new Set(merged.map(remap))]
      parent = remapped.length > 0 ? remapped : null
    }

    let children = treeNode.children
    if (children) {
      const filtered = children.filter((c) => c !== nodeIndex)
      const wasParent = children.includes(nodeIndex)
      const merged = wasParent ? [...filtered, ...childIndices] : filtered
      const remapped = [...new Set(merged.map(remap))]
      children = remapped.length > 0 ? remapped : null
    }

    return { ...treeNode, parent, children }
  })

  return rebuilt.filter((node): node is DependencyEntityNode => node !== null)
}

/**
 * Append a task node to a dependency tree as a "floating" node — one that
 * connects only the virtual start and end nodes (parent: null, children: null).
 * Appending at the end keeps existing indices stable, so no re-indexing is
 * needed. Returns a fresh tree; does nothing if the node already exists.
 */
export function appendFloatingTaskNode(
  tree: DependencyEntity["tree"],
  taskData: ID,
  title: string
): DependencyEntityNode[] {
  const next = cloneTree(tree)
  if (next.some((node) => node.data === taskData)) {
    return next
  }
  next.push({ data: taskData, title, parent: null, children: null })
  return next
}
