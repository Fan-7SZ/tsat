import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router"

import { TriggerTaskItem } from "@/components/task/TriggerTaskItem"

const meta = {
  title: "Task/TriggerTaskItem",
  component: TriggerTaskItem,
  args: {
    taskId: "task-trigger",
    title: "Water the plants",
    goalTitle: "Keep the garden alive",
    pullUps: [{ key: "1", label: "Thu" }],
    ruleSummary: "Weekly on Thu",
  },
  parameters: {
    layout: "padded",
    // Tooltip renders in a portal; render the story in its own iframe so the
    // overlay stays contained on the docs page.
    docs: { story: { inline: false, iframeHeight: 360 } },
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof TriggerTaskItem>

export default meta
type Story = StoryObj<typeof meta>

/** Single pull-up, pulled up by its own task-level trigger — no goal marker. */
export const TaskTrigger: Story = {
  args: {
    goalId: "goal-1",
    ruleSummary: "Every 3 days",
    windowLabel: "Jun 10 – Jul 10",
  },
}

/** Single pull-up, pulled up by its goal's trigger — shows the goal marker. */
export const ByGoalTrigger: Story = {
  args: {
    goalId: "goal-1",
    byGoalTrigger: true,
  },
}

export const WithDuration: Story = {
  args: {
    goalId: "goal-1",
    duration: 30,
    byGoalTrigger: true,
  },
}

/** Standalone task (no goal link), single pull-up. */
export const Standalone: Story = {
  args: {
    title: "Daily journaling",
    goalTitle: "Standalone",
    pullUps: [{ key: "1", label: "today" }],
  },
}

/** Several upcoming pull-ups; the chevron expands the rest (collapsed here). */
export const StackCollapsed: Story = {
  args: {
    goalId: "goal-1",
    byGoalTrigger: true,
    pullUps: [
      { key: "1", label: "Jun 18 (Thu)" },
      { key: "2", label: "Jun 25 (Thu)" },
      { key: "3", label: "Jul 02 (Thu)" },
    ],
  },
}

/** Same stack, expanded into plain date-only rows (no per-row actions). */
export const StackExpanded: Story = {
  args: {
    goalId: "goal-1",
    byGoalTrigger: true,
    defaultExpanded: true,
    pullUps: [
      { key: "1", label: "Jun 18 (Thu)" },
      { key: "2", label: "Jun 25 (Thu)" },
      { key: "3", label: "Jul 02 (Thu)" },
    ],
  },
}

export const MultipleItems: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <TriggerTaskItem
        taskId="t1"
        title="Water the plants"
        goalId="g1"
        goalTitle="Garden"
        byGoalTrigger
        ruleSummary="Weekly on Thu"
        pullUps={[
          { key: "1", label: "Jun 18 (Thu)" },
          { key: "2", label: "Jun 25 (Thu)" },
          { key: "3", label: "Jul 02 (Thu)" },
        ]}
      />
      <TriggerTaskItem
        taskId="t2"
        title="Weekly review"
        goalId="g2"
        goalTitle="Productivity"
        duration={45}
        ruleSummary="Weekly on Mon"
        windowLabel="Jun 1 – Aug 1"
        pullUps={[{ key: "1", label: "Mon" }]}
      />
      <TriggerTaskItem
        taskId="t3"
        title="Daily journaling"
        goalTitle="Standalone"
        ruleSummary="Daily"
        pullUps={[{ key: "1", label: "today" }]}
      />
    </div>
  ),
}
