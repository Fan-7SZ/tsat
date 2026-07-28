import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { userEvent, within } from "storybook/test"

import { DueDatePicker } from "@/components/shared/DueDatePicker"

function Harness({
  initialDate,
  disabled,
  ariaInvalid,
}: {
  initialDate?: Date
  disabled?: boolean
  ariaInvalid?: boolean
}) {
  const [date, setDate] = useState<Date | undefined>(initialDate)
  const [time, setTime] = useState("18:00")

  return (
    <div className="w-72 p-6">
      <DueDatePicker
        id="story-due-date"
        date={date}
        onDateChange={setDate}
        time={time}
        onTimeChange={setTime}
        timeLabel="Due time"
        selectDateAriaLabel="Select date"
        disabled={disabled}
        ariaInvalid={ariaInvalid}
      />
    </div>
  )
}

const meta = {
  title: "Shared/DueDatePicker",
  component: DueDatePicker,
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 480 } },
  },
  args: {
    date: undefined,
    onDateChange: () => {},
    time: "18:00",
    onTimeChange: () => {},
    timeLabel: "Due time",
    selectDateAriaLabel: "Select date",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DueDatePicker>

export default meta
type Story = StoryObj<typeof meta>

/** No due date yet — the input shows the `yyyy-MM-dd` placeholder. */
export const Empty: Story = {
  render: () => <Harness />,
}

/** A picked date rendered in the text field (typing a valid date also works). */
export const WithDate: Story = {
  render: () => <Harness initialDate={new Date(2026, 6, 15)} />,
}

/** Invalid state, e.g. the parent form flags a due date before today. */
export const Invalid: Story = {
  render: () => <Harness initialDate={new Date(2020, 0, 1)} ariaInvalid />,
}

/** Disabled input and calendar button. */
export const Disabled: Story = {
  render: () => <Harness initialDate={new Date(2026, 6, 15)} disabled />,
}

/** Calendar popover open, with the due-time field below the month grid. */
export const CalendarOpen: Story = {
  render: () => <Harness initialDate={new Date(2026, 6, 15)} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", { name: "Select date" })
    )
    // The popover renders in a portal outside the canvas element.
    const body = within(canvasElement.ownerDocument.body)
    await body.findByRole("grid")
  },
}
