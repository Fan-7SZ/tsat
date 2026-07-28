import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { WeekdayPicker } from "@/components/task/WeekdayPicker"

function Harness({
  initial = [],
  disabled = false,
}: {
  initial?: number[]
  disabled?: boolean
}) {
  const [value, setValue] = useState<number[]>(initial)
  return (
    <div className="p-6">
      <WeekdayPicker value={value} onChange={setValue} disabled={disabled} />
    </div>
  )
}

const meta = {
  title: "Task/WeekdayPicker",
  component: WeekdayPicker,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof WeekdayPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: { value: [], onChange: () => {} },
  render: () => <Harness />,
}

export const SomeSelected: Story = {
  args: { value: [1, 3, 5], onChange: () => {} },
  render: () => <Harness initial={[1, 3, 5]} />,
}

export const Disabled: Story = {
  args: { value: [1, 3], onChange: () => {}, disabled: true },
  render: () => <Harness initial={[1, 3]} disabled />,
}
