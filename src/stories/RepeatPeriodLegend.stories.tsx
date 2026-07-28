import type { Meta, StoryObj } from "@storybook/react-vite"

import { RepeatPeriodLegend } from "@/components/task/RepeatPeriodLegend"

const meta = {
  title: "Task/RepeatPeriodLegend",
  component: RepeatPeriodLegend,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof RepeatPeriodLegend>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="p-6">
      <RepeatPeriodLegend />
    </div>
  ),
}
