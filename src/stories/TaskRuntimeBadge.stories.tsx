import type { Meta, StoryObj } from "@storybook/react-vite"

import { TaskRuntimeBadge } from "@/components/task/TaskRuntimeBadge"
import { TaskCompletionBadge } from "@/components/task/TaskCompletionBadge"

const meta = {
  title: "Task/TaskRuntimeBadge",
  component: TaskRuntimeBadge,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof TaskRuntimeBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Todo: Story = { args: { status: "todo" } }
export const InProgress: Story = { args: { status: "inProgress" } }
export const Done: Story = { args: { status: "done" } }

export const AllStates: Story = {
  args: { status: "todo" },
  render: () => (
    <div className="flex items-center gap-2 p-6">
      <TaskRuntimeBadge status="todo" />
      <TaskRuntimeBadge status="inProgress" />
      <TaskRuntimeBadge status="done" />
    </div>
  ),
}

/**
 * With a `source`, hovering the badge reveals how the task was pulled into
 * today. Hover each badge below to read its source tooltip.
 */
export const WithSourceTooltip: Story = {
  args: { status: "todo", source: "duePolicy" },
}

export const AllSources: Story = {
  args: { status: "todo" },
  render: () => (
    <div className="flex items-center gap-2 p-6">
      <TaskRuntimeBadge status="todo" source="duePolicy" />
      <TaskRuntimeBadge status="todo" source="repeatPolicy" />
      <TaskRuntimeBadge status="inProgress" source="triggerPolicy" />
      <TaskRuntimeBadge status="todo" source="manual" />
      <TaskRuntimeBadge status="todo" source="default" />
    </div>
  ),
}

/**
 * Header pairing: task-level completion badge + today's runtime badge.
 * The runtime badge only appears when the task has a runtime today.
 */
export const TwoBadges: Story = {
  args: { status: "inProgress" },
  render: () => (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <TaskCompletionBadge category="repeat" completedCount={2} total={7} />
        <TaskRuntimeBadge status="todo" />
      </div>
      <div className="flex items-center gap-2">
        <TaskCompletionBadge category="repeat" completedCount={2} total={7} />
        <TaskRuntimeBadge status="inProgress" />
      </div>
      <div className="flex items-center gap-2">
        <TaskCompletionBadge category="multi" completedCount={5} total={5} />
        <TaskRuntimeBadge status="done" />
      </div>
      <div className="flex items-center gap-2">
        {/* No runtime today → completion badge only. */}
        <TaskCompletionBadge category="single" completedCount={0} total={1} />
      </div>
    </div>
  ),
}
