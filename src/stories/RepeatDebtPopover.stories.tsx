import type { Meta, StoryObj } from "@storybook/react-vite"

import { RepeatDebtPopover } from "@/components/task/RepeatDebtPopover"
import { LocalDateKeySchema } from "@/domain/value-objects/schemas"

const meta = {
  title: "Task/RepeatDebtPopover",
  component: RepeatDebtPopover,
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 480 } },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof RepeatDebtPopover>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    plannedForDate: LocalDateKeySchema.parse("2026-06-09"),
    onMarkDone: () => {},
    onIgnore: () => {},
  },
  render: (args) => (
    <div className="p-16">
      <RepeatDebtPopover {...args} />
    </div>
  ),
}
