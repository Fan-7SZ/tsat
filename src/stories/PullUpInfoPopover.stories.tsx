import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router"

import { PullUpInfoPopover } from "@/components/task/PullUpInfoPopover"
import { TaskItem } from "@/components/task/TaskItem"

const meta = {
  title: "Task/PullUpInfoPopover",
  component: PullUpInfoPopover,
  args: {
    kind: "trigger",
    ruleSummary: "Weekly on Thu",
    pullUpLabel: "Jun 18 (Thu)",
  },
  parameters: {
    layout: "centered",
    // Popover renders in a portal; isolate the story so it stays contained.
    docs: { story: { inline: false, iframeHeight: 360 } },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PullUpInfoPopover>

export default meta
type Story = StoryObj<typeof meta>

export const TriggerWithWindow: Story = {
  args: {
    kind: "trigger",
    ruleSummary: "Every 3 days",
    pullUpLabel: "Jun 16",
    windowLabel: "Jun 10 – Jul 10",
  },
}

export const TriggerNoWindow: Story = {
  args: { kind: "trigger", ruleSummary: "Weekly on Thu", pullUpLabel: "Jun 18 (Thu)" },
}

export const GoalTrigger: Story = {
  args: {
    kind: "goalTrigger",
    ruleSummary: "Weekly on Mon",
    pullUpLabel: "Jun 22 (Mon)",
  },
}

export const Repeat: Story = {
  args: {
    kind: "repeat",
    ruleSummary: "Every 2 days",
    pullUpLabel: "Jun 15",
  },
}

/**
 * Placement on a repeat preview item: the popover sits in TaskItem's trailing
 * `action` slot (where the debt popover lives for overdue items).
 */
export const InRepeatTaskItem: Story = {
  render: () => (
    <MemoryRouter>
      <TaskItem
        taskId="t1"
        title="Stretch routine"
        goalId="g1"
        goalTitle="Stay healthy"
        duration={15}
        plannedForLabel="Jun 15"
        action={
          <PullUpInfoPopover
            kind="repeat"
            ruleSummary="Every 2 days"
            pullUpLabel="Jun 15"
          />
        }
      />
    </MemoryRouter>
  ),
}
