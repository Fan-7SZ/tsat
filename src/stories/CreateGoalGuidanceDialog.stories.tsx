import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { CreateGoalGuidanceDialog } from "@/components/dialogs/CreateGoalGuidanceDialog"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import { db } from "@/persistence/db"
import { usePreparedStoryDb } from "@/stories/usePreparedStoryDb"
import { addDays } from "date-fns"

const sampleGoals: GoalEntity[] = [
  {
    id: "goal-root-1",
    title: "Build Track",
    description: "Create the product vision and roadmap.",
    createdAt: new Date(),
    dueAt: addDays(new Date(), 14),
  },
  {
    id: "goal-root-2",
    title: "Personal Growth",
    description: "Build a long-term self-improvement plan.",
    createdAt: new Date(),
    dueAt: addDays(new Date(), 30),
  },
] as const

async function setupCreateGoalGuidanceDialogStory() {
  await db.goals.bulkPut(sampleGoals)
}

async function teardownCreateGoalGuidanceDialogStory() {
  await db.goals.bulkDelete(sampleGoals.map((goal) => goal.id))
}

function StoryHarness() {
  const [open, setOpen] = useState(true)
  const isReady = usePreparedStoryDb(
    setupCreateGoalGuidanceDialogStory,
    teardownCreateGoalGuidanceDialogStory
  )

  if (!isReady) return null

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-6">
      <CreateGoalGuidanceDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}

const meta = {
  title: "Flows/CreateGoalGuidanceDialog",
  component: CreateGoalGuidanceDialog,
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: 640 } },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CreateGoalGuidanceDialog>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
  },
  render: () => <StoryHarness />,
}
