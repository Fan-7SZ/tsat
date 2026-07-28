import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { ChoiceCard } from "@/components/shared/choice-card"
import {
  SettingField,
  SettingFieldTitle,
} from "@/components/shared/setting-field"
import { Input } from "@/components/ui/input"

function Harness({
  initialChecked = false,
  disabled = false,
  description,
}: {
  initialChecked?: boolean
  disabled?: boolean
  description?: string
}) {
  const [checked, setChecked] = useState(initialChecked)

  return (
    <div className="w-96 p-6">
      <ChoiceCard
        id="story-choice-card"
        checked={checked}
        onCheckedChange={setChecked}
        disabled={disabled}
        title="Enable feature"
        description={description}
      >
        <SettingField>
          <SettingFieldTitle>Detail</SettingFieldTitle>
          <Input placeholder="Configure once enabled" />
        </SettingField>
      </ChoiceCard>
    </div>
  )
}

const meta = {
  title: "Shared/ChoiceCard",
  component: ChoiceCard,
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 360 } },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChoiceCard>

export default meta
type Story = StoryObj<typeof meta>

const baseArgs = {
  id: "story-choice-card",
  checked: false,
  onCheckedChange: () => {},
  title: "Enable feature",
}

/** Off — only title + description + switch. */
export const Collapsed: Story = {
  args: baseArgs,
  render: () => <Harness description="Turns the feature on for this item." />,
}

/** On — the config form expands inside the highlighted card. */
export const Expanded: Story = {
  args: baseArgs,
  render: () => (
    <Harness initialChecked description="Turns the feature on for this item." />
  ),
}

/** Disabled (e.g. blocked by a mutually-exclusive sibling). */
export const Disabled: Story = {
  args: baseArgs,
  render: () => <Harness disabled description="Disabled by another option." />,
}
