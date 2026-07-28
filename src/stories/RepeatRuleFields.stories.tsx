import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import {
  RepeatRuleFields,
  type RepeatMode,
} from "@/components/task/RepeatRuleFields"
import type { RepeatPeriodDraftValue } from "@/components/task/RepeatPeriodPicker"
import { useLanguage } from "@/components/shared/language-provider"

function Harness({
  initialMode = "none",
  withPeriod = false,
  disabled = false,
}: {
  initialMode?: RepeatMode
  withPeriod?: boolean
  disabled?: boolean
}) {
  const { t } = useLanguage()
  const [mode, setMode] = useState<RepeatMode>(initialMode)
  const [interval, setInterval] = useState(1)
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 3])
  const [period, setPeriod] = useState<RepeatPeriodDraftValue | undefined>(
    undefined
  )

  return (
    <div className="flex w-96 flex-col gap-3 p-6">
      <RepeatRuleFields
        mode={mode}
        onModeChange={setMode}
        interval={interval}
        onIntervalChange={setInterval}
        daysOfWeek={daysOfWeek}
        onDaysOfWeekChange={setDaysOfWeek}
        disabled={disabled}
        labels={{
          repeat: t.taskDetail.repeat,
          daily: t.taskDetail.daily,
          weekly: t.taskDetail.weekly,
          dailyInterval: t.taskDetail.everyNDays,
          daysOfWeek: t.taskDetail.daysOfWeek,
          everyNWeeks: t.taskDetail.everyNWeeks,
          period: t.createTask.repeatPeriod,
        }}
        period={
          withPeriod
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
  title: "Task/RepeatRuleFields",
  component: RepeatRuleFields,
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 480 } },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof RepeatRuleFields>

export default meta
type Story = StoryObj<typeof meta>

const baseArgs = {
  mode: "none" as RepeatMode,
  onModeChange: () => {},
  interval: 1,
  onIntervalChange: () => {},
  daysOfWeek: [],
  onDaysOfWeekChange: () => {},
  labels: {
    repeat: "Repeat",
    daily: "Daily",
    weekly: "Weekly",
    dailyInterval: "Every N days",
    daysOfWeek: "Days of week",
    everyNWeeks: "Every N weeks",
    period: "Repeat period",
  },
}

export const Off: Story = {
  args: baseArgs,
  render: () => <Harness initialMode="none" />,
}

export const Daily: Story = {
  args: baseArgs,
  render: () => <Harness initialMode="daily" />,
}

export const Weekly: Story = {
  args: baseArgs,
  render: () => <Harness initialMode="weekly" />,
}

export const WithPeriod: Story = {
  args: baseArgs,
  render: () => <Harness initialMode="daily" withPeriod />,
}

export const Disabled: Story = {
  args: baseArgs,
  render: () => <Harness initialMode="daily" disabled />,
}
