import type { Meta, StoryObj } from "@storybook/react-vite"
import { useMemo } from "react"
import { addDays } from "date-fns"
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import { GoalDetail } from "@/pages/GoalDetail"
import { fetchGoalDetailSource } from "@/hooks/use-entities"
import type { GoalID } from "@/domain/value-objects/types"
import { db } from "@/persistence/db"
import { usePreparedStoryDb } from "@/stories/usePreparedStoryDb"

const GOAL_ID = "goal-story-1"

const sampleGoal: GoalEntity = {
  id: GOAL_ID,
  title: "Build Track App",
  description: "Design and implement the full product roadmap.",
  createdAt: new Date(),
  dueAt: addDays(new Date(), 14),
}

async function setupGoalDetailStory() {
  await db.goals.put(sampleGoal)
}

async function teardownGoalDetailStory() {
  await db.goals.delete(GOAL_ID)
}

function StoryHarness() {
  const isReady = usePreparedStoryDb(
    setupGoalDetailStory,
    teardownGoalDetailStory
  )

  // The page reads its first frame from the route loader; stub it with the
  // same fetch the real loader uses (minus app bootstrap, which stories skip).
  // Created only once the db is seeded — the router runs loaders immediately.
  const router = useMemo(
    () =>
      isReady
        ? createMemoryRouter(
            [
              {
                path: "/goals/:id",
                element: <GoalDetail />,
                loader: ({ params }) =>
                  fetchGoalDetailSource(params.id as GoalID),
              },
            ],
            { initialEntries: [`/goals/${GOAL_ID}`] }
          )
        : null,
    [isReady]
  )

  if (!router) return null

  return (
    <div className="flex h-screen min-h-0 w-full flex-col">
      <RouterProvider router={router} />
    </div>
  )
}

const meta = {
  component: GoalDetail,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof GoalDetail>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <StoryHarness />,
}
