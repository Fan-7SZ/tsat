import type { Meta, StoryObj } from "@storybook/react-vite"
import { useMemo } from "react"
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import { TaskDetail } from "@/pages/TaskDetail"
import { fetchTaskDetailSource } from "@/hooks/use-entities"
import type { TaskID } from "@/domain/value-objects/types"
import { db } from "@/persistence/db"
import { usePreparedStoryDb } from "@/stories/usePreparedStoryDb"

/**
 * Story router: the page reads its first frame from the route loader; stub it
 * with the same fetch the real loader uses (minus app bootstrap + dayRuns,
 * which stories don't seed). Created only once the db is seeded — the router
 * runs loaders immediately.
 */
function useTaskDetailRouter(taskId: string, isReady: boolean) {
  return useMemo(
    () =>
      isReady
        ? createMemoryRouter(
            [
              {
                path: "/tasks/:id",
                element: <TaskDetail />,
                loader: async ({ params }) => ({
                  source: await fetchTaskDetailSource(params.id as TaskID),
                  dayRuns: [],
                }),
              },
            ],
            { initialEntries: [`/tasks/${taskId}`] }
          )
        : null,
    [taskId, isReady]
  )
}

const TASK_ID = "task-story-1"
const GOAL_ID = "goal-story-for-task-1"

const sampleGoal: GoalEntity = {
  id: GOAL_ID,
  title: "Build Track App",
  description: "Parent goal for story task.",
  createdAt: new Date(),
}

const sampleTask: TaskGroupEntity = {
  id: TASK_ID,
  goalId: GOAL_ID,
  title: "Implement InLineSwitchEditor",
  description: "Build view/edit switch interactions.",
  createdAt: new Date(),
  total: 3,
  completedCount: 1,
}

async function setupTaskDetailStory() {
  await Promise.all([db.goals.put(sampleGoal), db.tasks.put(sampleTask)])
}

async function teardownTaskDetailStory() {
  await Promise.all([db.goals.delete(GOAL_ID), db.tasks.delete(TASK_ID)])
}

function StoryHarness() {
  const isReady = usePreparedStoryDb(
    setupTaskDetailStory,
    teardownTaskDetailStory
  )

  const router = useTaskDetailRouter(TASK_ID, isReady)

  if (!router) return null

  return (
    <div className="flex h-screen min-h-0 w-full flex-col">
      <RouterProvider router={router} />
    </div>
  )
}

const TRIGGER_TASK_ID = "task-story-trigger-1"

function buildTriggerTask(allowCrossDay: boolean): TaskGroupEntity {
  return {
    ...sampleTask,
    id: TRIGGER_TASK_ID,
    title: "Water the plants",
    description: "Resets on a daily trigger.",
    total: 1,
    completedCount: 0,
    allowCrossDay,
    trigger: {
      rule: { mode: "daily", interval: 1 },
    },
  }
}

function TriggerStoryHarness({ allowCrossDay }: { allowCrossDay: boolean }) {
  const isReady = usePreparedStoryDb(
    async () => {
      await Promise.all([
        db.goals.put(sampleGoal),
        db.tasks.put(buildTriggerTask(allowCrossDay)),
      ])
    },
    async () => {
      await Promise.all([
        db.goals.delete(GOAL_ID),
        db.tasks.delete(TRIGGER_TASK_ID),
      ])
    }
  )

  const router = useTaskDetailRouter(TRIGGER_TASK_ID, isReady)

  if (!router) return null

  return (
    <div className="flex h-screen min-h-0 w-full flex-col">
      <RouterProvider router={router} />
    </div>
  )
}

const meta = {
  component: TaskDetail,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof TaskDetail>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <StoryHarness />,
}

export const WithTaskTriggerEnabled: Story = {
  render: () => <TriggerStoryHarness allowCrossDay={false} />,
}

export const WithTaskTriggerCrossDay: Story = {
  render: () => <TriggerStoryHarness allowCrossDay={true} />,
}
