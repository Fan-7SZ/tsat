import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { TaskStepItem } from "@/components/task/TaskStepItem"

const meta = {
  title: "Task/TaskStepItem",
  component: TaskStepItem,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="mx-auto w-96 max-w-full">
        <Story />
      </div>
    ),
  ],
  args: {
    id: "step-1",
    title: "Draft the outline",
    done: false,
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TaskStepItem>

export default meta
type Story = StoryObj<typeof meta>

/** Read-only row (todo / plan contexts): no checkbox rendered. */
export const ReadOnly: Story = {}

/** In-progress context: checkbox shown, step not yet done. */
export const WithCheckboxUnchecked: Story = {
  args: { showCheckbox: true },
}

/** In-progress context: checkbox shown and checked. */
export const WithCheckboxChecked: Story = {
  args: { showCheckbox: true, done: true },
}

/** A small list with live toggling — `done` is prop-driven from parent state. */
export const InteractiveList: Story = {
  render: () => {
    const [steps, setSteps] = useState([
      { id: "s1", title: "Draft the outline", done: true },
      { id: "s2", title: "Write the first section", done: false },
      { id: "s3", title: "Review and edit", done: false },
    ])
    return (
      <div className="flex flex-col gap-1">
        {steps.map((step) => (
          <TaskStepItem
            key={step.id}
            id={step.id}
            title={step.title}
            done={step.done}
            showCheckbox
            onToggleDone={(id) =>
              setSteps((prev) =>
                prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s))
              )
            }
          />
        ))}
      </div>
    )
  },
}
