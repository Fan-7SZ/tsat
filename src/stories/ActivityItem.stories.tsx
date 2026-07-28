import type { Meta, StoryObj } from "@storybook/react-vite"
import { ActivityItem } from "@/components/task/ActivityItem"
import { MemoryRouter } from "react-router"

const meta = {
  title: "Components/ActivityItem",
  component: ActivityItem,
  args: {
    kind: "task-done",
    taskId: "task-1",
    taskTitle: "Default Activity",
    recordedAt: "3h ago",
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ActivityItem>

export default meta
type Story = StoryObj<typeof meta>

export const Completed: Story = {
  args: {
    kind: "task-done",
    taskId: "task-1",
    taskTitle: "Buy groceries",
    recordedAt: "3h ago",
  },
}

export const Added: Story = {
  args: {
    kind: "task-in-progress",
    taskId: "task-2",
    taskTitle: "Write report",
    recordedAt: "1h ago",
  },
}

export const MultipleActivities: Story = {
  render: () => (
    <div className="space-y-3">
      <ActivityItem
        kind="task-done"
        taskId="t1"
        taskTitle="Completed Task 1"
        recordedAt="1h ago"
      />
      <ActivityItem
        kind="task-in-progress"
        taskId="t2"
        taskTitle="Added Task 2"
        recordedAt="3min ago"
      />
      <ActivityItem
        kind="task-done"
        taskId="t3"
        taskTitle="Completed Task 3"
        recordedAt="3h ago"
      />
    </div>
  ),
}
