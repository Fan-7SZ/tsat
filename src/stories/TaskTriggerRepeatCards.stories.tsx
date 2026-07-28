import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { TaskTriggerRepeatCards } from "@/components/task/TaskTriggerRepeatCards"
import type { RepeatMode } from "@/components/task/RepeatRuleFields"
import type { SelectTriggerMode } from "@/components/trigger/TriggerPanel"
import type { triggerRule } from "@/domain/value-objects/triggerRule"
import { buildDefaultTriggerRule } from "@/utils/trigger-draft"
import { useLanguage } from "@/components/shared/language-provider"

function Harness({
  initialMode = "none",
  initialTriggerEnabled = false,
}: {
  initialMode?: RepeatMode
  initialTriggerEnabled?: boolean
}) {
  const { t } = useLanguage()
  const [mode, setMode] = useState<RepeatMode>(initialMode)
  const [interval, setInterval] = useState(1)
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 3])
  const [triggerEnabled, setTriggerEnabled] = useState(initialTriggerEnabled)
  const [triggerDraft, setTriggerDraft] = useState<triggerRule | null>(
    initialTriggerEnabled ? buildDefaultTriggerRule("daily") : null
  )

  return (
    <div className="w-96 p-6">
      <TaskTriggerRepeatCards
        repeat={{
          mode,
          onModeChange: setMode,
          interval,
          onIntervalChange: setInterval,
          daysOfWeek,
          onDaysOfWeekChange: setDaysOfWeek,
          labels: {
            repeat: t.taskDetail.repeat,
            daily: t.taskDetail.daily,
            weekly: t.taskDetail.weekly,
            dailyInterval: t.taskDetail.everyNDays,
            daysOfWeek: t.taskDetail.daysOfWeek,
            everyNWeeks: t.taskDetail.everyNWeeks,
            period: t.createTask.repeatPeriod,
          },
        }}
        trigger={{
          id: "story-trigger",
          enabled: triggerEnabled,
          onEnabledChange: (checked) => {
            setTriggerEnabled(checked)
            if (checked) {
              if (!triggerDraft) setTriggerDraft(buildDefaultTriggerRule("daily"))
              setMode("none")
            }
          },
          title: t.taskDetail.trigger,
          config: {
            option: triggerDraft?.mode ?? null,
            onOptionChange: (next: SelectTriggerMode) => {
              if (!next) return
              setTriggerDraft(
                triggerDraft?.mode === next
                  ? triggerDraft
                  : buildDefaultTriggerRule(next)
              )
            },
            draft: triggerDraft,
            onDraftChange: setTriggerDraft,
          },
        }}
      />
    </div>
  )
}

const meta = {
  title: "Task/TaskTriggerRepeatCards",
  component: TaskTriggerRepeatCards,
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 520 } },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TaskTriggerRepeatCards>

export default meta
type Story = StoryObj<typeof meta>

const baseArgs = {
  repeat: {
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
  },
  trigger: {
    id: "story-trigger",
    enabled: false,
    onEnabledChange: () => {},
    title: "Trigger",
    config: {
      option: null,
      onOptionChange: () => {},
      draft: null,
      onDraftChange: () => {},
    },
  },
}

/** Both off — pick repeat OR trigger. */
export const Default: Story = {
  args: baseArgs,
  render: () => <Harness />,
}

/** Repeat on → trigger card is disabled. */
export const RepeatOn: Story = {
  args: baseArgs,
  render: () => <Harness initialMode="daily" />,
}

/** Trigger on → repeat card is disabled. */
export const TriggerOn: Story = {
  args: baseArgs,
  render: () => <Harness initialTriggerEnabled />,
}
