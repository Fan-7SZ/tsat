import type { Meta, StoryObj } from "@storybook/react-vite"

import { TaskCompletionBadge } from "@/components/task/TaskCompletionBadge"

const meta = {
  title: "Task/TaskCompletionBadge",
  component: TaskCompletionBadge,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof TaskCompletionBadge>

export default meta
type Story = StoryObj<typeof meta>

export const SingleInProgress: Story = {
  args: { category: "single", completedCount: 0, total: 1 },
}

export const SingleDone: Story = {
  args: { category: "single", completedCount: 1, total: 1 },
}

export const MultiInProgress: Story = {
  args: { category: "multi", completedCount: 3, total: 5 },
}

export const MultiDone: Story = {
  args: { category: "multi", completedCount: 5, total: 5 },
}

export const RepeatInProgress: Story = {
  args: { category: "repeat", completedCount: 2, total: 7 },
}

export const TriggerInProgress: Story = {
  args: { category: "trigger", completedCount: 1, total: 4 },
}

/** Every category × state side by side for a quick visual sweep. */
export const Gallery: Story = {
  args: { category: "single", completedCount: 0, total: 1 },
  render: () => (
    <div className="flex flex-col items-start gap-2 p-6">
      <TaskCompletionBadge category="single" completedCount={0} total={1} />
      <TaskCompletionBadge category="single" completedCount={1} total={1} />
      <TaskCompletionBadge category="multi" completedCount={3} total={5} />
      <TaskCompletionBadge category="multi" completedCount={5} total={5} />
      <TaskCompletionBadge category="repeat" completedCount={2} total={7} />
      <TaskCompletionBadge category="repeat" completedCount={7} total={7} />
      <TaskCompletionBadge category="trigger" completedCount={1} total={4} />
      <TaskCompletionBadge category="trigger" completedCount={4} total={4} />
    </div>
  ),
}

/** Mimics the task detail header: title + completion badge inline. */
export const InHeader: Story = {
  args: { category: "multi", completedCount: 3, total: 5 },
  render: () => (
    <div className="flex items-baseline-last gap-4 p-6">
      <h2 className="heading-2 truncate">Read 5 papers</h2>
      <TaskCompletionBadge category="multi" completedCount={3} total={5} />
    </div>
  ),
}
