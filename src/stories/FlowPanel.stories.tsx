import type { Meta, StoryObj } from "@storybook/react-vite"
import { useEffect, useMemo } from "react"

import {
  createDependency,
  deleteDependency,
} from "@/commands/dependency.commands"
import { FlowPanel } from "@/components/flow/FlowPanel"
import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import { useDeps } from "@/hooks/use-entities"

const mockDependencyEntity: DependencyEntity = {
  id: "dep-story-1",
  belongTo: "goal-1",
  tree: [
    {
      data: "entity-0",
      title: "Design System",
      parent: null,
      children: [1, 2],
    },
    {
      data: "entity-1",
      title: "Components",
      parent: [0],
      children: [3],
    },
    {
      data: "entity-2",
      title: "Documentation",
      parent: [0],
      children: null,
    },
    {
      data: "entity-3",
      title: "Testing",
      parent: [1],
      children: null,
    },
  ],
}

function StoryHarness({
  dependency,
  instructions,
}: {
  dependency: DependencyEntity
  instructions?: string
}) {
  const depsMap = useDeps()
  const committedDep = depsMap[dependency.id] ?? dependency

  useEffect(() => {
    void createDependency(dependency)
    return () => {
      void deleteDependency(dependency.id)
    }
  }, [dependency])

  const initialTree = useMemo(
    () => JSON.stringify(dependency.tree, null, 2),
    [dependency.tree]
  )

  const committedTree = useMemo(
    () => JSON.stringify(committedDep.tree, null, 2),
    [committedDep.tree]
  )

  return (
    <div className="flex flex-col gap-4 p-4" style={{ height: "100vh" }}>
      {/* FlowPanel */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          border: "1px solid #ccc",
          borderRadius: "8px",
        }}
      >
        <div
          style={{
            height: "40px",
            borderBottom: "1px solid #ccc",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: 600 }}>Dependency Flow</h2>
        </div>
        <div style={{ height: "calc(100% - 40px)" }}>
          <FlowPanel {...committedDep} />
        </div>
      </div>

      {/* Instructions */}
      {instructions ? (
        <div
          style={{
            border: "1px solid #ccc",
            borderRadius: "8px",
            background: "#fffbe6",
            padding: "8px 12px",
            fontSize: "12px",
          }}
        >
          {instructions}
        </div>
      ) : null}

      {/* Tree Data */}
      <div
        style={{
          height: "260px",
          border: "1px solid #ccc",
          borderRadius: "8px",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #ccc",
            borderRight: "1px solid #ccc",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          Initial tree (before save)
        </div>
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #ccc",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          Committed tree (store)
        </div>
        <pre
          style={{
            minHeight: 0,
            overflow: "auto",
            padding: "12px",
            margin: 0,
            fontSize: "12px",
            backgroundColor: "#f5f5f5",
            borderRight: "1px solid #ccc",
          }}
        >
          {initialTree}
        </pre>
        <pre
          style={{
            minHeight: 0,
            overflow: "auto",
            padding: "12px",
            margin: 0,
            fontSize: "12px",
            backgroundColor: "#f5f5f5",
          }}
        >
          {committedTree}
        </pre>
      </div>
    </div>
  )
}

const meta = {
  component: FlowPanel,
  parameters: {
    layout: "fullscreen",
  },
  title: "Components/FlowPanel",
} satisfies Meta<typeof FlowPanel>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: mockDependencyEntity,
  render: () => (
    <StoryHarness
      dependency={mockDependencyEntity}
      instructions="Try creating/removing business edges. Save updates the committed tree on the right."
    />
  ),
}

export const ComplexTree: Story = {
  args: {
    ...mockDependencyEntity,
    tree: [
      {
        data: "goal",
        title: "Complete Project",
        parent: null,
        children: [1, 2],
      },
      {
        data: "phase-1",
        title: "Phase 1: Research",
        parent: [0],
        children: [3, 4],
      },
      {
        data: "phase-2",
        title: "Phase 2: Development",
        parent: [0],
        children: [5],
      },
      {
        data: "task-1",
        title: "Market Analysis",
        parent: [1],
        children: null,
      },
      {
        data: "task-2",
        title: "Technical Spec",
        parent: [1],
        children: null,
      },
      {
        data: "task-3",
        title: "Implementation",
        parent: [2],
        children: null,
      },
    ],
  },
  render: () => (
    <StoryHarness
      dependency={{
        ...mockDependencyEntity,
        tree: [
          {
            data: "goal",
            title: "Complete Project",
            parent: null,
            children: [1, 2],
          },
          {
            data: "phase-1",
            title: "Phase 1: Research",
            parent: [0],
            children: [3, 4],
          },
          {
            data: "phase-2",
            title: "Phase 2: Development",
            parent: [0],
            children: [5],
          },
          {
            data: "task-1",
            title: "Market Analysis",
            parent: [1],
            children: null,
          },
          {
            data: "task-2",
            title: "Technical Spec",
            parent: [1],
            children: null,
          },
          {
            data: "task-3",
            title: "Implementation",
            parent: [2],
            children: null,
          },
        ],
      }}
    />
  ),
}

export const StartEndFallback: Story = {
  args: {
    id: "dep-story-fallback",
    belongTo: "goal-fallback",
    tree: [
      {
        data: "root",
        title: "Root-like Node",
        parent: null,
        children: [1],
      },
      {
        data: "middle",
        title: "Middle Node",
        parent: [0],
        children: [2],
      },
      {
        data: "leaf",
        title: "Leaf-like Node",
        parent: [1],
        children: null,
      },
    ],
  },
  render: () => (
    <StoryHarness
      dependency={{
        id: "dep-story-fallback",
        belongTo: "goal-fallback",
        tree: [
          {
            data: "root",
            title: "Root-like Node",
            parent: null,
            children: [1],
          },
          {
            data: "middle",
            title: "Middle Node",
            parent: [0],
            children: [2],
          },
          {
            data: "leaf",
            title: "Leaf-like Node",
            parent: [1],
            children: null,
          },
        ],
      }}
      instructions="Nodes without parent/children should render fallback edges to Start/End."
    />
  ),
}

export const CycleBlockedOnConnect: Story = {
  args: {
    id: "dep-story-cycle",
    belongTo: "goal-cycle",
    tree: [
      {
        data: "a",
        title: "Node A",
        parent: null,
        children: [1],
      },
      {
        data: "b",
        title: "Node B",
        parent: [0],
        children: [2],
      },
      {
        data: "c",
        title: "Node C",
        parent: [1],
        children: null,
      },
    ],
  },
  render: () => (
    <StoryHarness
      dependency={{
        id: "dep-story-cycle",
        belongTo: "goal-cycle",
        tree: [
          {
            data: "a",
            title: "Node A",
            parent: null,
            children: [1],
          },
          {
            data: "b",
            title: "Node B",
            parent: [0],
            children: [2],
          },
          {
            data: "c",
            title: "Node C",
            parent: [1],
            children: null,
          },
        ],
      }}
      instructions="Try connecting Node C back to Node A; cycle edge should be rejected during connect."
    />
  ),
}
