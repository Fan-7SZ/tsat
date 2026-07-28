import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { StepsEditor } from "@/components/task/StepsEditor"
import { createStep, type Step } from "@/domain/value-objects/types"

function Harness({
  initial = [],
  editable = true,
  disabled = false,
  scroll = false,
  addRowFirst = false,
}: {
  initial?: string[]
  editable?: boolean
  disabled?: boolean
  scroll?: boolean
  addRowFirst?: boolean
}) {
  const [steps, setSteps] = useState<Step[]>(() => initial.map(createStep))
  const [stepInput, setStepInput] = useState("")

  return (
    <div className="flex w-96 flex-col gap-2 p-6">
      <StepsEditor
        steps={steps}
        stepInput={stepInput}
        onStepInputChange={setStepInput}
        onAddStep={() => {
          const trimmed = stepInput.trim()
          if (!trimmed) return
          setSteps((s) => [...s, createStep(trimmed)])
          setStepInput("")
        }}
        onUpdateStep={
          editable
            ? (index, value) =>
                setSteps((s) =>
                  s.map((v, i) => (i === index ? { ...v, title: value } : v))
                )
            : undefined
        }
        onRemoveStep={
          editable
            ? (index) => setSteps((s) => s.filter((_, i) => i !== index))
            : undefined
        }
        onReorderSteps={editable ? setSteps : undefined}
        disabled={disabled}
        placeholder="Add a step…"
        scrollClassName={scroll ? "h-24 w-full" : undefined}
        addRowFirst={addRowFirst}
      />
    </div>
  )
}

const meta = {
  title: "Task/StepsEditor",
  component: StepsEditor,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof StepsEditor>

export default meta
type Story = StoryObj<typeof meta>

const baseArgs = {
  steps: [],
  stepInput: "",
  onStepInputChange: () => {},
  onAddStep: () => {},
  placeholder: "Add a step…",
}

export const Empty: Story = {
  args: baseArgs,
  render: () => <Harness />,
}

export const EditableList: Story = {
  args: baseArgs,
  render: () => <Harness initial={["Step 1", "Step 2"]} scroll />,
}

export const ReadOnly: Story = {
  args: baseArgs,
  render: () => <Harness initial={["Step 1", "Step 2"]} editable={false} />,
}

export const Disabled: Story = {
  args: baseArgs,
  render: () => <Harness initial={["Step 1"]} disabled />,
}

export const AddRowOnTop: Story = {
  args: baseArgs,
  render: () => (
    <Harness initial={["Step 1", "Step 2"]} editable={false} addRowFirst />
  ),
}
