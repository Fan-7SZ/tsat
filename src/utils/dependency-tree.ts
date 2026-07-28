import type {
  DependencyEntity,
  DependencyEntityNode,
} from "@/domain/entities/DependencyEntity"
import type { ID, Index } from "@/domain/value-objects/types"

export interface IndexedDependencyNode {
  index: Index
  node: DependencyEntityNode
}

export function findDependencyNodeIndex(
  dependency: DependencyEntity,
  nodeData: ID
): Index {
  return dependency.tree.findIndex((node) => node.data === nodeData)
}

export function collectAncestorIndices(
  dependency: DependencyEntity,
  nodeData: ID
): Index[] {
  const startIndex = findDependencyNodeIndex(dependency, nodeData)
  if (startIndex < 0) {
    return []
  }

  const visited = new Set<Index>()
  const stack: Index[] = [...(dependency.tree[startIndex]?.parent ?? [])]

  while (stack.length > 0) {
    const currentIndex = stack.pop()
    if (currentIndex == null || visited.has(currentIndex)) {
      continue
    }

    visited.add(currentIndex)

    const parents = dependency.tree[currentIndex]?.parent ?? []
    for (const parentIndex of parents) {
      if (!visited.has(parentIndex)) {
        stack.push(parentIndex)
      }
    }
  }

  return [...visited]
}

export function collectAncestorNodes(
  dependency: DependencyEntity,
  nodeData: ID
): IndexedDependencyNode[] {
  return collectAncestorIndices(dependency, nodeData)
    .map((index) => {
      const node = dependency.tree[index]
      if (!node) {
        return null
      }

      return { index, node }
    })
    .filter((entry): entry is IndexedDependencyNode => entry != null)
}

export function collectDescendantIndices(
  dependency: DependencyEntity,
  nodeData: ID
): Index[] {
  const startIndex = findDependencyNodeIndex(dependency, nodeData)
  if (startIndex < 0) {
    return []
  }

  const visited = new Set<Index>()
  const stack: Index[] = [...(dependency.tree[startIndex]?.children ?? [])]

  while (stack.length > 0) {
    const currentIndex = stack.pop()
    if (currentIndex == null || visited.has(currentIndex)) {
      continue
    }

    visited.add(currentIndex)

    const children = dependency.tree[currentIndex]?.children ?? []
    for (const childIndex of children) {
      if (!visited.has(childIndex)) {
        stack.push(childIndex)
      }
    }
  }

  return [...visited]
}

export function collectDescendantNodes(
  dependency: DependencyEntity,
  nodeData: ID
): IndexedDependencyNode[] {
  return collectDescendantIndices(dependency, nodeData)
    .map((index) => {
      const node = dependency.tree[index]
      if (!node) {
        return null
      }

      return { index, node }
    })
    .filter((entry): entry is IndexedDependencyNode => entry != null)
}
