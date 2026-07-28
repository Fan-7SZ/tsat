import type { Meta, StoryObj } from "@storybook/react-vite"

import { TriggerHelpTooltip } from "@/components/trigger/TriggerHelpTooltip"

const meta = {
  title: "Trigger/TriggerHelpTooltip",
  component: TriggerHelpTooltip,
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 320 } },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TriggerHelpTooltip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="p-10">
      <TriggerHelpTooltip />
    </div>
  ),
}
