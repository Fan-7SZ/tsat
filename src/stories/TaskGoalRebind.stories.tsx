import { useMemo, useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { ConfirmDeleteDialog } from "@/components/dialogs/ConfirmDeleteDialog"
import { GoalSelect } from "@/components/goal/GoalSelect"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/components/shared/language-provider"
import { useTaskGoalRebind } from "@/hooks/use-task-goal-rebind"
import { useDeps } from "@/hooks/use-entities"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { GoalID } from "@/domain/value-objects/types"
import { db } from "@/persistence/db"
import { usePreparedStoryDb } from "@/stories/usePreparedStoryDb"

// ── Seed data ──────────────────────────────────────────────
// Goal A holds a "diamond": task T has TWO parents (P1, P2) and a child (C).
// Detaching T bridges C up to both P1 and P2 (all parents adopt). T is also
// multi-run (total: 3), so moving it to a standalone / triggered destination
// needs the normalization confirm.

const GOAL_A = "goal-a" as GoalID
const GOAL_B = "goal-b" as GoalID

const sampleGoals: GoalEntity[] = [
  { id: GOAL_A, title: "Goal A (source)", createdAt: new Date() },
  { id: GOAL_B, title: "Goal B (normal)", createdAt: new Date() },
]

const baseTask = (
  id: string,
  title: string,
  goalId: GoalID,
  extra?: Partial<TaskGroupEntity>
): TaskGroupEntity => ({
  id,
  goalId,
  title,
  createdAt: new Date(),
  total: 1,
  completedCount: 0,
  ...extra,
})

const sampleTasks: TaskGroupEntity[] = [
  baseTask("task-p1", "P1 (parent)", GOAL_A),
  baseTask("task-p2", "P2 (parent)", GOAL_A),
  baseTask("task-t", "T (moves)", GOAL_A, { total: 3 }),
  baseTask("task-c", "C (dependent)", GOAL_A),
]

const sampleDep: DependencyEntity = {
  id: "dep-a",
  belongTo: GOAL_A,
  tree: [
    { data: "task-p1", title: "P1 (parent)", parent: null, children: [2] },
    { data: "task-p2", title: "P2 (parent)", parent: null, children: [2] },
    { data: "task-t", title: "T (moves)", parent: [0, 1], children: [3] },
    { data: "task-c", title: "C (dependent)", parent: [2], children: null },
  ],
}

async function setup() {
  await db.goals.bulkPut(sampleGoals)
  await db.tasks.bulkPut(sampleTasks)
  await db.deps.put(sampleDep)
}

async function teardown() {
  await db.goals.bulkDelete(sampleGoals.map((g) => g.id))
  await db.tasks.bulkDelete(sampleTasks.map((t) => t.id))
  await db.deps.clear()
}

function TreeView({ label, dep }: { label: string; dep?: DependencyEntity }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg border p-3">
      <p className="mb-1 text-sm font-semibold">{label}</p>
      <pre className="overflow-auto rounded bg-muted p-2 text-xs">
        {dep ? JSON.stringify(dep.tree, null, 2) : "— (no dependency tree)"}
      </pre>
    </div>
  )
}

function FullFlowHarness() {
  const ready = usePreparedStoryDb(setup, teardown)
  const rebind = useTaskGoalRebind()
  const depsMap = useDeps()

  const depA = useMemo(
    () => Object.values(depsMap).find((d) => d.belongTo === GOAL_A),
    [depsMap]
  )
  const depB = useMemo(
    () => Object.values(depsMap).find((d) => d.belongTo === GOAL_B),
    [depsMap]
  )

  // Reflect T's real binding: whichever tree currently contains its node.
  const currentGoalOfT = useMemo(() => {
    const owner = Object.values(depsMap).find((d) =>
      d.tree.some((n) => n.data === "task-t")
    )
    return owner?.belongTo as GoalID | undefined
  }, [depsMap])

  if (!ready) return null

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed">
        Move task <strong>T</strong> with the picker below.
        <br />• <strong>→ Goal B</strong>: shows the <em>bridge-parent</em>{" "}
        dialog (T has two parents + a dependent).
        <br />• <strong>→ standalone</strong>: shows the bridge dialog, then the{" "}
        <em>normalization</em> confirm (T is multi-run).
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Task T's goal:</span>
        <div className="w-56">
          <GoalSelect
            value={currentGoalOfT}
            onChange={(goalId) => void rebind.requestRebind("task-t", goalId)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <TreeView label="Goal A tree (source)" dep={depA} />
        <TreeView label="Goal B tree (destination)" dep={depB} />
      </div>

      {rebind.dialogs}
    </div>
  )
}

const meta = {
  title: "Flows/TaskGoalRebind",
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: 640 } },
  },
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

/**
 * Live end-to-end flow against a seeded DB. Watch Goal A / Goal B trees update
 * after each move; the normalization dialog appears when needed.
 */
export const FullFlow: Story = {
  render: () => <FullFlowHarness />,
}

/** The normalization confirm in isolation (destination forbids multi-run). */
export const NormalizeConfirmOnly: Story = {
  render: function NormalizeOnly() {
    const { t } = useLanguage()
    const [open, setOpen] = useState(true)
    return (
      <div className="p-6">
        <Button onClick={() => setOpen(true)}>Open normalize confirm</Button>
        <ConfirmDeleteDialog
          open={open}
          onOpenChange={setOpen}
          title={t.goalRebind.normalizeTitle}
          description={t.goalRebind.normalizeDescription}
          confirmLabel={t.common.continue}
          onConfirm={() => {
            /* demo only */
          }}
        />
      </div>
    )
  },
}
