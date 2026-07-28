import type { Meta, StoryObj } from "@storybook/react-vite"

import { TimeQuotaView } from "@/components/task/TimeQuotaView"

const meta = {
  title: "Task/TimeQuotaView",
  component: TimeQuotaView,
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 320 } },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-80 p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TimeQuotaView>

export default meta
type Story = StoryObj<typeof meta>

export const UnderCapacity: Story = {
  args: { usedMinutes: 120, dailyCapacityMinutes: 480 },
}

export const NearCapacity: Story = {
  args: { usedMinutes: 440, dailyCapacityMinutes: 480 },
}

export const OverCapacity: Story = {
  args: { usedMinutes: 540, dailyCapacityMinutes: 480 },
}
