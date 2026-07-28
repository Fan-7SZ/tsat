import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { TriggerConfigFields } from "@/components/trigger/TriggerConfigFields"
import type { SelectTriggerMode } from "@/components/trigger/TriggerPanel"
import type { RepeatPeriodDraftValue } from "@/components/task/RepeatPeriodPicker"
import type { triggerRule } from "@/domain/value-objects/triggerRule"

function Harness({ withTaskExtras }: { withTaskExtras: boolean }) {
  const [option, setOption] = useState<SelectTriggerMode>("daily")
  const [draft, setDraft] = useState<triggerRule | null>({
    mode: "daily",
    interval: 1,
  })
  const [period, setPeriod] = useState<RepeatPeriodDraftValue | undefined>(
    undefined
  )

  return (
    <div className="flex w-96 flex-col gap-3 p-6">
      <TriggerConfigFields
        option={option}
        onOptionChange={setOption}
        draft={draft}
        onDraftChange={setDraft}
        period={
          withTaskExtras
            ? {
                value: period,
                onChange: setPeriod,
                isDateDisabled: () => false,
                message: null,
              }
            : undefined
        }
      />
    </div>
  )
}

const meta = {
  title: "Trigger/TriggerConfigFields",
  component: TriggerConfigFields,
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 480 } },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TriggerConfigFields>

export default meta
type Story = StoryObj<typeof meta>

// Goal subset: mode select + rule panel only (no validity window / cross-day).
export const GoalSubset: Story = {
  args: {
    option: "daily",
    onOptionChange: () => {},
    draft: { mode: "daily", interval: 1 },
    onDraftChange: () => {},
  },
  render: () => <Harness withTaskExtras={false} />,
}

// Task full: adds the validity window picker.
export const TaskFull: Story = {
  args: {
    option: "daily",
    onOptionChange: () => {},
    draft: { mode: "daily", interval: 1 },
    onDraftChange: () => {},
  },
  render: () => <Harness withTaskExtras />,
}
