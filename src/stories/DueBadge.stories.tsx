import type { Meta, StoryObj } from "@storybook/react-vite"
import { addDays, subDays } from "date-fns"

import { DueBadge } from "@/components/shared/DueBadge"
import { TaskCompletionBadge } from "@/components/task/TaskCompletionBadge"
import { TaskRuntimeBadge } from "@/components/task/TaskRuntimeBadge"

// Fixed reference "now" so every story renders a stable relative label.
const NOW = new Date("2026-06-15T09:00:00")

const meta = {
  title: "Shared/DueBadge",
  component: DueBadge,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { now: NOW },
} satisfies Meta<typeof DueBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Overdue: Story = {
  args: { dueAt: subDays(NOW, 2) },
}

export const DueToday: Story = {
  args: { dueAt: NOW },
}

export const DueTomorrow: Story = {
  args: { dueAt: addDays(NOW, 1) },
}

export const InDays: Story = {
  args: { dueAt: addDays(NOW, 3) },
}

/** Every relative state side by side. */
export const Gallery: Story = {
  args: { dueAt: NOW },
  render: () => (
    <div className="flex flex-col items-start gap-2 p-6">
      <DueBadge dueAt={subDays(NOW, 2)} now={NOW} />
      <DueBadge dueAt={NOW} now={NOW} />
      <DueBadge dueAt={addDays(NOW, 1)} now={NOW} />
      <DueBadge dueAt={addDays(NOW, 3)} now={NOW} />
    </div>
  ),
}

/**
 * Mimics a detail header for a due-policy forced entity:
 * completion badge + runtime badge (with source tooltip) + due badge.
 */
export const InHeader: Story = {
  args: { dueAt: addDays(NOW, 2) },
  render: () => (
    <div className="flex items-center gap-2 p-6">
      <TaskCompletionBadge category="single" completedCount={0} total={1} />
      <TaskRuntimeBadge status="todo" source="duePolicy" />
      <DueBadge dueAt={addDays(NOW, 2)} now={NOW} />
    </div>
  ),
}
