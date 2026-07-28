import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { TriggerChoiceCard } from "@/components/trigger/TriggerChoiceCard"
import { SettingFieldError } from "@/components/shared/setting-field"
import type { SelectTriggerMode } from "@/components/trigger/TriggerPanel"
import type { RepeatPeriodDraftValue } from "@/components/task/RepeatPeriodPicker"
import type { triggerRule } from "@/domain/value-objects/triggerRule"

function Harness({
  initialEnabled = false,
  disabled = false,
  withValidityWindow = false,
  error,
}: {
  initialEnabled?: boolean
  disabled?: boolean
  withValidityWindow?: boolean
  error?: string
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [option, setOption] = useState<SelectTriggerMode>("daily")
  const [draft, setDraft] = useState<triggerRule | null>({
    mode: "daily",
    interval: 1,
  })
  const [period, setPeriod] = useState<RepeatPeriodDraftValue | undefined>(
    undefined
  )

  return (
    <div className="w-96 p-6">
      <TriggerChoiceCard
        id="story-trigger-card"
        enabled={enabled}
        onEnabledChange={setEnabled}
        disabled={disabled}
        title="Trigger"
        description="Re-adds this task to today on a schedule."
        switchAriaLabel="Enable trigger"
        config={{
          option,
          onOptionChange: setOption,
          draft,
          onDraftChange: setDraft,
          period: withValidityWindow
            ? {
                value: period,
                onChange: setPeriod,
                isDateDisabled: () => false,
                message: null,
              }
            : undefined,
        }}
        error={
          error ? <SettingFieldError>{error}</SettingFieldError> : undefined
        }
      />
    </div>
  )
}

const meta = {
  title: "Trigger/TriggerChoiceCard",
  component: TriggerChoiceCard,
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 480 } },
  },
  args: {
    id: "story-trigger-card",
    enabled: false,
    onEnabledChange: () => {},
    title: "Trigger",
    config: {
      option: "daily",
      onOptionChange: () => {},
      draft: { mode: "daily", interval: 1 },
      onDraftChange: () => {},
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TriggerChoiceCard>

export default meta
type Story = StoryObj<typeof meta>

/** Off — only the header row with the bell icon, description and switch. */
export const Off: Story = {
  render: () => <Harness />,
}

/** On — the trigger config fields expand inside the card body. */
export const Enabled: Story = {
  render: () => <Harness initialEnabled />,
}

/** Task variant — the config additionally shows the validity-window picker. */
export const EnabledWithValidityWindow: Story = {
  render: () => <Harness initialEnabled withValidityWindow />,
}

/** Validation message rendered under the config fields. */
export const WithError: Story = {
  render: () => (
    <Harness initialEnabled error="Pick at least one weekday for this rule." />
  ),
}

/** Disabled, e.g. blocked by a mutually-exclusive repeat rule. */
export const Disabled: Story = {
  render: () => <Harness disabled />,
}
