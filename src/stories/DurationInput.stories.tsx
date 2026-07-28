import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { DurationInput } from "@/components/shared/DurationInput"

function Harness({
  initial,
  disabled = false,
}: {
  initial?: number
  disabled?: boolean
}) {
  const [value, setValue] = useState<number | undefined>(initial)
  return (
    <div className="w-72 p-6">
      <DurationInput value={value} onChange={setValue} disabled={disabled} />
    </div>
  )
}

const meta = {
  title: "Shared/DurationInput",
  component: DurationInput,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof DurationInput>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: { value: undefined, onChange: () => {} },
  render: () => <Harness />,
}

export const WithValue: Story = {
  args: { value: 45, onChange: () => {} },
  render: () => <Harness initial={45} />,
}

export const Disabled: Story = {
  args: { value: 30, onChange: () => {}, disabled: true },
  render: () => <Harness initial={30} disabled />,
}
