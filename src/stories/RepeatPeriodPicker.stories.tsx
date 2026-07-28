import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { addDays } from "date-fns"

import {
  RepeatPeriodPicker,
  type RepeatPeriodDraftValue,
} from "@/components/task/RepeatPeriodPicker"
import { RepeatPeriodLegend } from "@/components/task/RepeatPeriodLegend"

function Harness({
  initial,
  withLegend = false,
  disabled = false,
}: {
  initial?: RepeatPeriodDraftValue
  withLegend?: boolean
  disabled?: boolean
}) {
  const [value, setValue] = useState<RepeatPeriodDraftValue | undefined>(
    initial
  )
  return (
    <div className="p-6">
      <RepeatPeriodPicker
        value={value}
        onChange={(range) => setValue(range)}
        disabled={disabled ? () => true : undefined}
        footer={withLegend ? <RepeatPeriodLegend /> : undefined}
      />
    </div>
  )
}

const meta = {
  title: "Task/RepeatPeriodPicker",
  component: RepeatPeriodPicker,
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 480 } },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof RepeatPeriodPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: { onChange: () => {} },
  render: () => <Harness />,
}

export const RangeSelected: Story = {
  args: { onChange: () => {} },
  render: () => (
    <Harness initial={{ start: new Date(), end: addDays(new Date(), 6) }} />
  ),
}

export const WithLegendFooter: Story = {
  args: { onChange: () => {} },
  render: () => (
    <Harness
      initial={{ start: new Date(), end: addDays(new Date(), 6) }}
      withLegend
    />
  ),
}

export const Disabled: Story = {
  args: { onChange: () => {} },
  render: () => <Harness disabled />,
}
