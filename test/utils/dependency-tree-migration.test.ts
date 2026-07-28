import { describe, expect, it } from "vitest"

import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import {
  appendFloatingTaskNode,
  removeTaskNodeFromTree,
} from "@/utils/dependency-tree-migration"

// A "diamond": T has two parents (P1, P2) and one child (C).
//   0: P1  children:[2]
//   1: P2  children:[2]
//   2: T   parent:[0,1] children:[3]
//   3: C   parent:[2]
function diamond(): DependencyEntity {
  return {
    id: "dep",
    belongTo: "goal",
    tree: [
      { data: "p1", title: "P1", parent: null, children: [2] },
      { data: "p2", title: "P2", parent: null, children: [2] },
      { data: "t", title: "T", parent: [0, 1], children: [3] },
      { data: "c", title: "C", parent: [2], children: null },
    ],
  }
}

// A simple chain: P -> T -> C (single parent).
function chain(): DependencyEntity {
  return {
    id: "dep",
    belongTo: "goal",
    tree: [
      { data: "p", title: "P", parent: null, children: [1] },
      { data: "t", title: "T", parent: [0], children: [2] },
      { data: "c", title: "C", parent: [1], children: null },
    ],
  }
}

describe("removeTaskNodeFromTree", () => {
  function byData(tree: DependencyEntity["tree"], data: string) {
    return tree.find((n) => n.data === data)!
  }

  it("bridges children up to all parents, re-indexing the tree", () => {
    const next = removeTaskNodeFromTree(diamond().tree, "t")

    // T is gone; indices shift down by one (C was 3 -> 2).
    expect(next.map((n) => n.data)).toEqual(["p1", "p2", "c"])

    const p1 = byData(next, "p1")
    const p2 = byData(next, "p2")
    const c = byData(next, "c")

    // Both parents adopt C; C inherits both P1 and P2 as parents.
    expect(p1.children).toEqual([2])
    expect(p2.children).toEqual([2])
    expect(c.parent).toEqual([0, 1])
  })

  it("re-parents a single-parent chain", () => {
    const next = removeTaskNodeFromTree(chain().tree, "t")
    expect(next.map((n) => n.data)).toEqual(["p", "c"])
    // P now points directly at C (index 1); C's parent is P (index 0).
    expect(byData(next, "p").children).toEqual([1])
    expect(byData(next, "c").parent).toEqual([0])
  })

  it("returns a clone unchanged when the node is absent", () => {
    const tree = chain().tree
    const next = removeTaskNodeFromTree(tree, "missing")
    expect(next).toEqual(tree)
    expect(next).not.toBe(tree)
  })
})

describe("appendFloatingTaskNode", () => {
  it("adds a floating (start->node->end) node to the end", () => {
    const next = appendFloatingTaskNode(chain().tree, "new", "New Task")
    expect(next).toHaveLength(4)
    const added = next[3]!
    expect(added).toEqual({
      data: "new",
      title: "New Task",
      parent: null,
      children: null,
    })
  })

  it("creates a single-node tree from an empty tree", () => {
    const next = appendFloatingTaskNode([], "new", "New Task")
    expect(next).toEqual([
      { data: "new", title: "New Task", parent: null, children: null },
    ])
  })

  it("is a no-op when the node already exists", () => {
    const next = appendFloatingTaskNode(chain().tree, "t", "T")
    expect(next).toHaveLength(3)
  })
})
