import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router"
import { GoalItem } from "@/components/goal/GoalItem"

const baseArgs = {
  id: "goal-story-1",
  title: "Default Goal",
  tasksCount: [2, 5] as [number, number],
}

const meta = {
  title: "Components/GoalItem",
  component: GoalItem,
  args: baseArgs,
  parameters: {
    layout: "padded",
    docs: { story: { inline: false, iframeHeight: 320 } },
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof GoalItem>

type Story = StoryObj<typeof meta>

export default meta

export const Default: Story = {
  args: {
    ...baseArgs,
  },
}

export const WithoutDueDate: Story = {
  args: {
    ...baseArgs,
    id: "goal-story-2",
    title: "Goal without Due Date",
    tasksCount: [1, 3],
  },
}

export const WithoutRepeat: Story = {
  args: {
    ...baseArgs,
    id: "goal-story-3",
    title: "Goal without Repeat",
    tasksCount: [0, 4],
  },
}

export const MultipleGoals: Story = {
  args: baseArgs,
  render: () => (
    <div className="space-y-3">
      <GoalItem id="goal-story-1" title="Goal 1" tasksCount={[2, 5]} />
      <GoalItem id="goal-story-2" title="Goal 2" tasksCount={[1, 3]} />
      <GoalItem id="goal-story-3" title="Goal 3" tasksCount={[0, 4]} />
    </div>
  ),
}
