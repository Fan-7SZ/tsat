import { describe, expect, it } from "vitest"

import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { GoalID } from "@/domain/value-objects/types"
import {
  collectAncestorIndices,
  collectAncestorNodes,
  collectDescendantIndices,
  collectDescendantNodes,
  findDependencyNodeIndex,
} from "@/utils/dependency-tree"

// Diamond: goal → A, goal → B, A → C, B → C.
const dependency: DependencyEntity = {
  id: "dep-1",
  belongTo: "goal-1" as GoalID,
  tree: [
    { data: "goal-1", title: "Goal", parent: null, children: [1, 2] },
    { data: "task-a", title: "Task A", parent: [0], children: [3] },
    { data: "task-b", title: "Task B", parent: [0], children: [3] },
    { data: "task-c", title: "Task C", parent: [1, 2], children: null },
  ],
}

describe("findDependencyNodeIndex", () => {
  it("finds the index of a node by its data", () => {
    expect(findDependencyNodeIndex(dependency, "task-b")).toBe(2)
  })

  it("returns -1 for an unknown node", () => {
    expect(findDependencyNodeIndex(dependency, "nope")).toBe(-1)
  })
})

describe("collectAncestorIndices", () => {
  it("walks every parent path, visiting shared ancestors once", () => {
    expect(collectAncestorIndices(dependency, "task-c").sort()).toEqual([
      0, 1, 2,
    ])
  })

  it("returns [] for the root (no parents)", () => {
    expect(collectAncestorIndices(dependency, "goal-1")).toEqual([])
  })

  it("returns [] for an unknown node", () => {
    expect(collectAncestorIndices(dependency, "nope")).toEqual([])
  })
})

describe("collectDescendantIndices", () => {
  it("walks every child path, visiting the shared descendant once", () => {
    expect(collectDescendantIndices(dependency, "goal-1").sort()).toEqual([
      1, 2, 3,
    ])
  })

  it("returns [] for a leaf", () => {
    expect(collectDescendantIndices(dependency, "task-c")).toEqual([])
  })

  it("returns [] for an unknown node", () => {
    expect(collectDescendantIndices(dependency, "nope")).toEqual([])
  })
})

describe("collectAncestorNodes / collectDescendantNodes", () => {
  it("pairs each index with its node", () => {
    const ancestors = collectAncestorNodes(dependency, "task-c")
    expect(ancestors.map((e) => e.node.data).sort()).toEqual([
      "goal-1",
      "task-a",
      "task-b",
    ])
    for (const entry of ancestors) {
      expect(dependency.tree[entry.index]).toBe(entry.node)
    }
  })

  it("tolerates duplicate parent/children index entries", () => {
    const doubled: DependencyEntity = {
      id: "dep-3",
      belongTo: "goal-1" as GoalID,
      tree: [
        { data: "goal-1", title: "Goal", parent: null, children: [1, 1] },
        { data: "task-a", title: "Task A", parent: [0, 0], children: null },
      ],
    }

    expect(collectAncestorIndices(doubled, "task-a")).toEqual([0])
    expect(collectDescendantIndices(doubled, "goal-1")).toEqual([1])
  })

  it("drops dangling indices that point at no node", () => {
    const broken: DependencyEntity = {
      id: "dep-2",
      belongTo: "goal-1" as GoalID,
      tree: [{ data: "task-x", title: "Task X", parent: [9], children: [9] }],
    }

    expect(collectAncestorNodes(broken, "task-x")).toEqual([])
    expect(collectDescendantNodes(broken, "task-x")).toEqual([])
  })
})
