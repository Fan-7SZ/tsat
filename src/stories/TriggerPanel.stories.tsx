import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import {
  TriggerPanel,
  type SelectTriggerMode,
} from "@/components/trigger/TriggerPanel"
import type { triggerRule } from "@/domain/value-objects/triggerRule"

function Harness({ initial }: { initial: triggerRule }) {
  const [value, setValue] = useState<triggerRule>(initial)
  return (
    <div className="w-96 p-6">
      <TriggerPanel
        triggerOption={value.mode as SelectTriggerMode}
        value={value}
        onValueChange={setValue}
      />
    </div>
  )
}

const meta = {
  title: "Trigger/TriggerPanel",
  component: TriggerPanel,
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 480 } },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TriggerPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Daily: Story = {
  args: { triggerOption: "daily", onValueChange: () => {} },
  render: () => <Harness initial={{ mode: "daily", interval: 1 }} />,
}

export const Weekly: Story = {
  args: { triggerOption: "weekly", onValueChange: () => {} },
  render: () => (
    <Harness initial={{ mode: "weekly", interval: 1, daysOfWeek: [1, 4] }} />
  ),
}

export const Monthly: Story = {
  args: { triggerOption: "monthly", onValueChange: () => {} },
  render: () => <Harness initial={{ mode: "monthly", dayOfMonth: 15 }} />,
}

export const Custom: Story = {
  args: { triggerOption: "custom", onValueChange: () => {} },
  render: () => <Harness initial={{ mode: "custom", date: [] }} />,
}
