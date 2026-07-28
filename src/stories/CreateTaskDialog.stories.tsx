import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router"
import { addDays } from "date-fns"

import { CreateTaskDialog } from "@/components/dialogs/CreateTaskDialog"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { GoalID } from "@/domain/value-objects/types"
import { db } from "@/persistence/db"
import { usePreparedStoryDb } from "@/stories/usePreparedStoryDb"

// A goal with a duration so the "under goal" flow can exercise repeat / due
// fields that depend on the parent goal window.
const sampleGoal: GoalEntity = {
  id: "goal-create-task-1" as GoalID,
  title: "Ship v1",
  description: "Bind tasks to this goal.",
  createdAt: new Date(),
  dueAt: addDays(new Date(), 14),
}

async function setupCreateTaskDialogStory() {
  await db.goals.bulkPut([sampleGoal])
}

async function teardownCreateTaskDialogStory() {
  await db.goals.bulkDelete([sampleGoal.id])
}

function StoryHarness({ fixedGoalId }: { fixedGoalId?: GoalID }) {
  const [open, setOpen] = useState(true)
  const isReady = usePreparedStoryDb(
    setupCreateTaskDialogStory,
    teardownCreateTaskDialogStory
  )

  if (!isReady) return null

  return (
    <MemoryRouter>
      <div className="flex min-h-screen items-center justify-center bg-muted/20 p-6">
        <CreateTaskDialog
          open={open}
          onOpenChange={setOpen}
          fixedGoalId={fixedGoalId}
        />
      </div>
    </MemoryRouter>
  )
}

const meta = {
  title: "Flows/CreateTaskDialog",
  component: CreateTaskDialog,
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: 640 } },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CreateTaskDialog>

export default meta
type Story = StoryObj<typeof meta>

// Plain task creation: no goal binding passed in. Defaults to "no goal" with a
// due date, and the user may optionally pick a goal from the dropdown.
export const StandaloneTask: Story = {
  args: { open: true, onOpenChange: () => {} },
  render: () => <StoryHarness />,
}

// Creation triggered from a goal's "add task" button: the parent goal is
// pre-bound via fixedGoalId, so the goal selector is locked and repeat / due
// fields follow the goal's window.
export const UnderGoal: Story = {
  args: { open: true, onOpenChange: () => {} },
  render: () => <StoryHarness fixedGoalId={sampleGoal.id} />,
}
