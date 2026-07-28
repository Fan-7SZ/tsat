import type { Meta, StoryObj } from "@storybook/react-vite"

import { FocusQuotaView } from "@/components/goal/FocusQuotaView"

const meta = {
  title: "Goal/FocusQuotaView",
  component: FocusQuotaView,
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
} satisfies Meta<typeof FocusQuotaView>

export default meta
type Story = StoryObj<typeof meta>

export const HasRoom: Story = {
  args: {
    focusedCount: 1,
    forcedFocusedCount: 0,
    maxFocusGoals: 3,
  },
}

export const OverLimit: Story = {
  args: {
    focusedCount: 4,
    forcedFocusedCount: 1,
    maxFocusGoals: 3,
  },
}
