import type { Meta, StoryObj } from "@storybook/react-vite"
import { addDays } from "date-fns"

import {
  PlanningPressureGrid,
  type DayPressure,
} from "@/components/home/PlanningPressureGrid"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toLocalDateKey } from "@/utils/date"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import type {
  DueContribution,
  PressureContribution,
  PressureReason,
} from "@/utils/planning-pressure"

const TODAY = new Date(2026, 5, 14) // 2026-06-14
const MONTH_END = new Date(2026, 5, 27) // near month boundary → forecast crosses into July

/** Compact contribution builder for stories. `goalTitle` doubles as `goalId`. */
function item(
  reason: PressureReason,
  title: string,
  goalTitle?: string,
  minutes?: number
): PressureContribution {
  return {
    reason,
    title,
    goalId: goalTitle,
    goalTitle,
    taskId: reason === "goalTrigger" ? undefined : title,
    minutes,
  }
}

/** Compact due-item builder for stories. */
function due(
  kind: "task" | "goal",
  title: string,
  goalTitle?: string,
  timeLabel?: string
): DueContribution {
  return { kind, id: `${kind}-${title}`, title, goalTitle, timeLabel }
}

/** Assemble a DayPressure from its contributions (count/minutes derived). */
function day(
  items: PressureContribution[],
  dueItems?: DueContribution[]
): DayPressure {
  const minutes = items.reduce((sum, i) => sum + (i.minutes ?? 0), 0)
  return {
    count: items.length,
    minutes: minutes || undefined,
    items,
    due: dueItems,
  }
}

/** Build pressure by day-offset from a given anchor. */
function build(
  anchor: Date,
  offsets: Record<number, DayPressure>
): Record<LocalDateKey, DayPressure> {
  const out: Record<string, DayPressure> = {}
  for (const [offset, pressure] of Object.entries(offsets)) {
    out[toLocalDateKey(addDays(anchor, Number(offset)))] = pressure
  }
  return out as Record<LocalDateKey, DayPressure>
}

// 健身目标 / 工作目标 / 阅读目标 / 未关联目标:任务各自带 repeat / 任务触发。
// 学习目标 / 复盘目标:目标级触发(其下所有 task 都标「目标触发」)。

const light = build(TODAY, {
  // single goal, repeat + task trigger
  0: day([
    item("repeat", "晨跑", "健身目标", 30),
    item("taskTrigger", "拉伸", "健身目标", 15),
  ]),
  1: day([item("repeat", "读 30 页", "阅读目标")]),
  // goal-triggered: every task of 学习目标 is pulled up by the goal trigger
  3: day([
    item("goalTrigger", "背单词", "学习目标", 30),
    item("goalTrigger", "刷题", "学习目标", 45),
  ]),
  6: day([item("repeat", "倒垃圾")]), // no goal
  10: day([
    item("taskTrigger", "周报", "工作目标", 45),
    item("repeat", "站会", "工作目标"),
  ]),
})

const busy = build(TODAY, {
  // one goal, repeat + task trigger across several tasks
  0: day([
    item("repeat", "晨跑", "健身目标", 30),
    item("taskTrigger", "拉伸", "健身目标", 15),
    item("repeat", "喝水打卡", "健身目标"),
    item("taskTrigger", "称体重", "健身目标"),
  ]),
  1: day([
    item("repeat", "站会", "工作目标"),
    item("taskTrigger", "周报", "工作目标", 45),
  ]),
  // multiple goals + a no-goal bucket; 学习目标 is goal-triggered (all tasks)
  2: day([
    item("taskTrigger", "周报", "工作目标", 45),
    item("repeat", "晨跑", "健身目标", 30),
    item("goalTrigger", "背单词", "学习目标", 30),
    item("goalTrigger", "刷题", "学习目标", 45),
    item("repeat", "倒垃圾"),
    item("taskTrigger", "缴水电费"),
  ]),
  3: day([
    item("repeat", "读 30 页", "阅读目标"),
    item("taskTrigger", "写读书笔记", "阅读目标", 40),
  ]),
  // long list → exercises max-h scroll
  6: day([
    item("repeat", "晨跑", "健身目标", 30),
    item("taskTrigger", "拉伸", "健身目标", 15),
    item("goalTrigger", "背单词", "学习目标", 30),
    item("goalTrigger", "刷题", "学习目标", 45),
    item("goalTrigger", "复习错题", "学习目标"),
    item("repeat", "站会", "工作目标"),
    item("taskTrigger", "周报", "工作目标", 30),
    item("repeat", "倒垃圾"),
    item("taskTrigger", "缴水电费"),
  ]),
  // single item — a one-task goal-triggered goal
  7: day([item("goalTrigger", "写复盘", "复盘目标")]),
  8: day([
    item("repeat", "晨跑", "健身目标", 30),
    item("goalTrigger", "背单词", "学习目标", 30),
  ]),
  10: day([
    item("taskTrigger", "周报", "工作目标", 45),
    item("repeat", "站会", "工作目标"),
    item("goalTrigger", "背单词", "学习目标"),
    item("repeat", "晨跑", "健身目标", 15),
  ]),
  13: day([
    item("repeat", "读 30 页", "阅读目标"),
    item("taskTrigger", "写读书笔记", "阅读目标", 40),
  ]),
})

const crossMonth = build(MONTH_END, {
  0: day([
    item("repeat", "晨跑", "健身目标", 30),
    item("taskTrigger", "周报", "工作目标", 30),
    item("repeat", "倒垃圾"),
  ]),
  2: day([
    item("goalTrigger", "背单词", "学习目标", 30),
    item("goalTrigger", "刷题", "学习目标", 45),
    item("repeat", "晨跑", "健身目标", 30),
    item("taskTrigger", "缴水电费"),
  ]),
  4: day([item("repeat", "读 30 页", "阅读目标")]),
  6: day([
    // lands in July
    item("taskTrigger", "周报", "工作目标", 45),
    item("repeat", "站会", "工作目标"),
    item("repeat", "晨跑", "健身目标", 30),
    item("goalTrigger", "写复盘", "复盘目标"),
  ]),
  9: day([
    item("repeat", "晨跑", "健身目标", 30),
    item("taskTrigger", "拉伸", "健身目标", 15),
    item("goalTrigger", "背单词", "学习目标", 30),
    item("goalTrigger", "刷题", "学习目标", 45),
    item("repeat", "倒垃圾"),
  ]),
  12: day([
    item("repeat", "站会", "工作目标"),
    item("taskTrigger", "周报", "工作目标", 30),
    item("repeat", "倒垃圾"),
  ]),
})

// Due emphasis: tasks/goals whose own dueAt lands that day → destructive border
// + a dedicated hover-card section, layered over the amber pull-up heat.
const withDue = build(TODAY, {
  // both: pull-ups (amber heat) AND a due task + due goal that day
  0: day(
    [
      item("repeat", "晨跑", "健身目标", 30),
      item("taskTrigger", "拉伸", "健身目标", 15),
    ],
    [
      due("task", "提交季度报告", "工作目标", "18:00"),
      due("goal", "健身目标", undefined),
    ]
  ),
  // due only — destructive border with no heat behind it
  2: day([], [due("task", "续签合同", "工作目标", "12:00")]),
  // pull-ups only (no due) — plain amber, for contrast
  4: day([item("repeat", "读 30 页", "阅读目标")]),
  // several due items → exercises the due list
  5: day(
    [item("goalTrigger", "背单词", "学习目标", 30)],
    [
      due("task", "缴房租", undefined, "23:59"),
      due("task", "项目里程碑评审", "工作目标", "10:00"),
      due("goal", "阅读目标"),
    ]
  ),
  9: day([], [due("goal", "学习目标"), due("task", "体检预约", "健身目标")]),
})

/** A day with exactly `count` pull-ups — for the heat-scale demo. */
function fillerDay(count: number): DayPressure {
  return day(
    Array.from({ length: count }, (_, i) =>
      item("repeat", `任务${i + 1}`, "压力演示", 15)
    )
  )
}

// Counts 1..15 laid out across the forecast so the amber→orange ramp shows end
// to end and high counts (10 vs 15) read as distinct. Hover a cell for its count.
const HEAT_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15]
const heatScale = build(
  TODAY,
  Object.fromEntries(HEAT_COUNTS.map((c, i) => [i, fillerDay(c)]))
)

/** Card wrapper matching the Home slot dimensions. */
function PressureCard({
  today,
  pressureByDay,
}: {
  today: Date
  pressureByDay: Record<LocalDateKey, DayPressure>
}) {
  return (
    <div className="h-[460px] w-[420px]">
      <Card className="flex h-full flex-col shadow">
        <CardHeader>
          <CardTitle>规划压力 · 未来 14 天</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col justify-center">
          <PlanningPressureGrid today={today} pressureByDay={pressureByDay} />
        </CardContent>
      </Card>
    </div>
  )
}

const meta = {
  title: "Home/PlanningPressureGrid",
  component: PlanningPressureGrid,
  parameters: {
    layout: "centered",
    // HoverCard renders in a portal; render the story in its own iframe so the
    // hover popover stays visible within the story canvas.
    docs: { story: { inline: false, iframeHeight: 560 } },
  },
} satisfies Meta<typeof PlanningPressureGrid>

export default meta
type Story = StoryObj<typeof meta>

/** Typical week: a few scattered light/medium days. Hover a coloured cell. */
export const InCard: Story = {
  args: { today: TODAY, pressureByDay: light },
  render: () => <PressureCard today={TODAY} pressureByDay={light} />,
}

/** Heavy forecast — hover the 7th cell from today for the long, scrolling list. */
export const Busy: Story = {
  args: { today: TODAY, pressureByDay: busy },
  render: () => <PressureCard today={TODAY} pressureByDay={busy} />,
}

/** Today near month end — forecast window spills into the next month. */
export const CrossMonth: Story = {
  args: { today: MONTH_END, pressureByDay: crossMonth },
  render: () => <PressureCard today={MONTH_END} pressureByDay={crossMonth} />,
}

/**
 * Due emphasis: red-bordered cells (with a corner dot) mark days where a task
 * or goal is due. Hover day 0 for the combined Due + Pulled-up card; day 2 is
 * due-only (no heat); day 5 has several due items.
 */
export const WithDue: Story = {
  args: { today: TODAY, pressureByDay: withDue },
  render: () => <PressureCard today={TODAY} pressureByDay={withDue} />,
}

/**
 * Heat scale: cells carry an increasing pull-up count from 1 up to 15 (left→
 * right, top→bottom), so the amber→orange ramp is visible end to end and 10 vs
 * 15 read as distinct colours. Hover any cell to confirm its count.
 */
export const HeatScale: Story = {
  args: { today: TODAY, pressureByDay: heatScale },
  render: () => <PressureCard today={TODAY} pressureByDay={heatScale} />,
}

/** Empty forecast — no pressure anywhere (no hover cards). */
export const Empty: Story = {
  args: { today: TODAY, pressureByDay: {} },
  render: () => <PressureCard today={TODAY} pressureByDay={{}} />,
}

/** Bare component without the card chrome. */
export const Bare: Story = {
  args: { today: TODAY, pressureByDay: busy },
  render: () => (
    <div className="w-[380px]">
      <PlanningPressureGrid today={TODAY} pressureByDay={busy} />
    </div>
  ),
}
