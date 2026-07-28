import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { TaskItem } from "@/components/task/TaskItem"
import { MemoryRouter } from "react-router"

const SAMPLE_STEPS = [
  { id: "s1", title: "Draft the outline", done: true },
  { id: "s2", title: "Write the first section", done: true },
  { id: "s3", title: "Review and edit", done: false },
  { id: "s4", title: "Publish", done: false },
]

const meta = {
  title: "Components/TaskItem",
  component: TaskItem,
  args: {
    taskId: "task-default",
    title: "Default Task",
    goalTitle: "Default Goal",
  },
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof TaskItem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    taskId: "task-default",
    title: "Default Task",
    goalTitle: "Default Goal",
  },
}

export const WithDuration: Story = {
  args: {
    taskId: "task-duration",
    title: "Task with duration",
    goalTitle: "Goal Name",
    duration: 120,
  },
}

export const MultipleTasks: Story = {
  render: () => (
    <div className="space-y-3">
      <TaskItem
        taskId="task-1"
        title="Task 1"
        goalTitle="Goal 1"
        duration={30}
      />
      <TaskItem
        taskId="task-2"
        title="Task 2"
        goalTitle="Goal 2"
        duration={60}
      />
      <TaskItem taskId="task-3" title="Task 3" goalTitle="Goal 3" />
    </div>
  ),
}

// Non-inProgress (todo / plan): steps are viewable but read-only. The badge
// shows the plain count because showStepProgress is false and no
// onStepsCheckChange is passed (so no checkboxes render).
export const StepsCountOnly: Story = {
  args: {
    taskId: "task-steps-count",
    title: "Task with steps (count only)",
    goalTitle: "Goal Name",
    steps: SAMPLE_STEPS,
    showStepProgress: false,
  },
}

// inProgress: editable. onStepsCheckChange is provided, so checkboxes render
// and toggling flips `done` (held in local state here) — the ratio badge
// updates live. `done` is prop-driven; TaskItem does not own step state.
export const InProgressEditable: Story = {
  render: () => {
    const [steps, setSteps] = useState(SAMPLE_STEPS)
    return (
      <TaskItem
        taskId="task-steps-editable"
        title="Task in progress (editable steps)"
        goalTitle="Goal Name"
        steps={steps}
        showStepProgress
        onStepsCheckChange={(stepId, done) =>
          setSteps((prev) =>
            prev.map((s) => (s.id === stepId ? { ...s, done } : s))
          )
        }
      />
    )
  },
}

// done: like todo, the badge shows the plain count (showStepProgress false);
// list expandable but read-only (no onStepsCheckChange).
export const DoneReadonly: Story = {
  args: {
    taskId: "task-steps-done",
    title: "Completed task (read-only steps)",
    goalTitle: "Goal Name",
    steps: SAMPLE_STEPS.map((s) => ({ ...s, done: true })),
    showStepProgress: false,
  },
}
