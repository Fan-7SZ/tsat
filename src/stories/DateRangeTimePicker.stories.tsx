import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { DateRange } from "react-day-picker"
import { addDays } from "date-fns"

import { DateRangeTimePicker } from "@/components/shared/DateRangeTimePicker"

function Harness({ initial }: { initial?: DateRange }) {
  const [range, setRange] = useState<DateRange | undefined>(initial)
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("18:00")
  return (
    <div className="p-6">
      <DateRangeTimePicker
        dateRange={range}
        onDateRangeChange={setRange}
        startTime={startTime}
        onStartTimeChange={setStartTime}
        endTime={endTime}
        onEndTimeChange={setEndTime}
        idPrefix="story"
      />
    </div>
  )
}

const meta = {
  title: "Shared/DateRangeTimePicker",
  component: DateRangeTimePicker,
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 480 } },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DateRangeTimePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    dateRange: undefined,
    onDateRangeChange: () => {},
    startTime: "09:00",
    onStartTimeChange: () => {},
    endTime: "18:00",
    onEndTimeChange: () => {},
  },
  render: () => <Harness />,
}

export const RangeSelected: Story = {
  args: {
    dateRange: undefined,
    onDateRangeChange: () => {},
    startTime: "09:00",
    onStartTimeChange: () => {},
    endTime: "18:00",
    onEndTimeChange: () => {},
  },
  render: () => (
    <Harness initial={{ from: new Date(), to: addDays(new Date(), 5) }} />
  ),
}
