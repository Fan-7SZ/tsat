import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { PlannerDialog } from "@/components/dialogs/PlannerDialog"
import { Button } from "@/components/ui/button"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TagDefinition } from "@/domain/entities/TagDefinition"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { DayRunEntity } from "@/domain/entities/TaskRuntimeEntity"
import { db } from "@/persistence/db"
import { toLocalDateKey } from "@/utils/date"
import { usePreparedStoryDb } from "@/stories/usePreparedStoryDb"

const TAG: TagDefinition = {
  id: "tag-planner-story",
  name: "Deep work",
  color: "#6366f1",
  iconKey: "Code",
  kind: "custom",
}

const GOAL: GoalEntity = {
  id: "goal-planner-story",
  tagId: TAG.id,
  title: "Ship v1",
  createdAt: new Date(),
}

const TASKS: TaskGroupEntity[] = [
  {
    id: "task-planner-story-1",
    goalId: GOAL.id,
    title: "Write weekly report",
    createdAt: new Date(),
    estimatedDuration: 120,
    total: 1,
    completedCount: 0,
  },
  {
    id: "task-planner-story-2",
    goalId: GOAL.id,
    title: "Review pull requests",
    createdAt: new Date(),
    estimatedDuration: 45,
    total: 1,
    completedCount: 0,
  },
  {
    id: "task-planner-story-3",
    title: "Standalone errand (no goal)",
    createdAt: new Date(),
    total: 1,
    completedCount: 0,
  },
]

// Two todo + one in-progress run today — each becomes a gantt row.
const DAY_RUNS: DayRunEntity[] = TASKS.map((task, index) => ({
  id: `run-planner-story-${index + 1}`,
  taskId: task.id,
  arrangementStatus: index === 1 ? "inProgress" : "todo",
  source: "manual",
  dateKey: toLocalDateKey(new Date()),
}))

async function seed(withRuns: boolean) {
  await Promise.all([
    db.tags.put(TAG),
    db.goals.put(GOAL),
    db.tasks.bulkPut(TASKS),
    withRuns ? db.dayRuns.bulkPut(DAY_RUNS) : Promise.resolve(),
  ])
}

async function unseed() {
  await Promise.all([
    db.tags.delete(TAG.id),
    db.goals.delete(GOAL.id),
    db.tasks.bulkDelete(TASKS.map((t) => t.id)),
    db.dayRuns.bulkDelete(DAY_RUNS.map((r) => r.id)),
  ])
}

const setupWithRuns = () => seed(true)
const setupWithoutRuns = () => seed(false)

/**
 * The dialog reads today's tasks straight from the live home-page VM, so the
 * story seeds goals/tasks/dayRuns into the (Storybook-local) Dexie db. Blocks
 * live in the planner zustand store: click or drag on a row to create one,
 * then the export menu enables.
 */
function Harness({ withRuns }: { withRuns: boolean }) {
  const [open, setOpen] = useState(true)
  const isReady = usePreparedStoryDb(
    withRuns ? setupWithRuns : setupWithoutRuns,
    unseed
  )

  if (!isReady) return null

  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)}>Open planner</Button>
      <PlannerDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}

const meta = {
  title: "Dialogs/PlannerDialog",
  component: PlannerDialog,
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: 720 } },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PlannerDialog>

export default meta
type Story = StoryObj<typeof meta>

const noopArgs = { open: true, onOpenChange: () => {} }

/** Three of today's tasks as rows (goal-colored, one without a goal). */
export const WithTodayTasks: Story = {
  args: noopArgs,
  render: () => <Harness withRuns />,
}

/** Nothing arranged today — the empty-track placeholder. */
export const Empty: Story = {
  args: noopArgs,
  render: () => <Harness withRuns={false} />,
}
