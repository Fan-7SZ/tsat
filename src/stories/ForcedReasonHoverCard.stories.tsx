import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router"

import {
  GoalForcedHoverCard,
  TaskForcedHoverCard,
  RepeatForcedHoverCard,
} from "@/components/shared/ForcedReasonHoverCard"
import type { GoalFocusStatus } from "@/domain/derived/GoalFocus"
import type { TaskID } from "@/domain/value-objects/types"
import { LocalDateKeySchema } from "@/domain/value-objects/schemas"
import { Badge } from "@/components/ui/badge"

const taskId = "task-1" as TaskID
const trigger = <Badge variant="outline">hover for reason</Badge>

const goalStatuses: GoalFocusStatus[] = [
  { kind: "goalDuePolicy", isBlocking: true, dueAt: new Date() },
  {
    kind: "taskDuePolicy",
    isBlocking: true,
    taskId,
    taskTitle: "Submit report",
    dueAt: new Date(),
  },
  {
    kind: "repeatPolicyPoint",
    isBlocking: true,
    taskId,
    taskTitle: "Daily review",
    plannedForDate: LocalDateKeySchema.parse("2026-06-09"),
  },
  {
    kind: "taskTriggerPolicy",
    isBlocking: true,
    taskId,
    taskTitle: "Water the plants",
    firedDate: LocalDateKeySchema.parse("2026-06-10"),
  },
]

const meta = {
  title: "Shared/ForcedReasonHoverCard",
  component: GoalForcedHoverCard,
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 320 } },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="p-16">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof GoalForcedHoverCard>

export default meta
type Story = StoryObj<typeof meta>

const goalArgs = {
  goalId: "goal-1",
  goalTitle: "Build Track",
  statuses: goalStatuses,
  children: trigger,
}

export const GoalForced: Story = {
  args: goalArgs,
  render: () => (
    <GoalForcedHoverCard
      goalId="goal-1"
      goalTitle="Build Track"
      statuses={goalStatuses}
    >
      {trigger}
    </GoalForcedHoverCard>
  ),
}

export const TaskForced: Story = {
  args: goalArgs,
  render: () => (
    <TaskForcedHoverCard
      taskId="task-1"
      taskTitle="Submit report"
      dueAt={new Date()}
      goalId="goal-1"
      goalTitle="Build Track"
    >
      {trigger}
    </TaskForcedHoverCard>
  ),
}

export const RepeatForced: Story = {
  args: goalArgs,
  render: () => (
    <RepeatForcedHoverCard
      taskId="task-1"
      taskTitle="Daily review"
      plannedForDate="2026-06-09"
    >
      {trigger}
    </RepeatForcedHoverCard>
  ),
}
