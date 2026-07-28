/**
 * Default auto-test scenario. One coherent "two-month" starting state that
 * exercises every scheduling mechanism at least once:
 *
 *  - plain single-run tasks + a dependency chain (frontier gating)
 *  - a counter task (total > 1) for addTaskRun
 *  - a daily-repeat task whose window opens BEFORE the start day → seeds debt
 *  - a weekly-repeat task + a goal soft-due
 *  - an allowCrossDay task (in-progress carry-over across the day boundary)
 *  - a goal-level trigger (weekly) + a task-level trigger (every 3 days)
 *
 * Repeat windows are expressed relative to the start day via a builder so the
 * scenario is independent of the concrete simulated calendar date.
 */
import type { SeedScenario } from "./seed"
import type { TaskRepeatConfig } from "@/domain/entities/TaskGroupEntity"

function offset(start: Date, days: number): Date {
  const d = new Date(start)
  d.setDate(d.getDate() + days)
  return d
}

function dailyRepeat(start: Date, from: number, to: number): TaskRepeatConfig {
  return {
    rule: { mode: "daily", interval: 1 },
    startsAt: offset(start, from),
    endsAt: offset(start, to),
  }
}

function weeklyRepeat(
  start: Date,
  daysOfWeek: number[],
  from: number,
  to: number
): TaskRepeatConfig {
  return {
    rule: { mode: "weekly", interval: 1, daysOfWeek },
    startsAt: offset(start, from),
    endsAt: offset(start, to),
  }
}

export function buildDefaultScenario(start: Date): SeedScenario {
  return {
    goals: [
      {
        key: "fitness",
        title: "健身计划",
        tasks: [
          { key: "gear", title: "购买装备" },
          { key: "card", title: "办理健身卡", dependsOn: ["gear"] },
          { key: "sessions", title: "完成训练课", total: 3 },
          { key: "chores", title: "打扫卫生", total: 5 },
        ],
      },
      {
        key: "reading",
        title: "阅读习惯",
        dueInDays: 45,
        tasks: [
          {
            key: "daily",
            title: "每日阅读",
            // Window opened 5 days before start → 5 overdue points = debt today.
            repeat: dailyRepeat(start, -5, 40),
          },
          {
            key: "notes",
            title: "整理读书笔记",
            allowCrossDay: true,
            steps: ["摘录", "总结", "复盘"],
          },
        ],
      },
      {
        key: "checkup",
        title: "定期体检",
        trigger: { rule: { mode: "weekly", interval: 1, daysOfWeek: [1] } },
        tasks: [
          { key: "book", title: "预约医院" },
          { key: "visit", title: "前往体检", dependsOn: ["book"] },
        ],
      },
      {
        // Trigger that deliberately stamps NO due date: firing should focus the
        // goal for the day on its own, not lean on a due-policy side effect.
        key: "nodue",
        title: "无期限触发",
        trigger: {
          rule: { mode: "weekly", interval: 1, daysOfWeek: [3] }, // Wednesdays
          setDueOnReset: false,
        },
        tasks: [{ key: "chore", title: "倒垃圾" }],
      },
      {
        key: "study",
        title: "语言学习",
        dueInDays: 30,
        tasks: [
          {
            key: "class",
            title: "上网课",
            repeat: weeklyRepeat(start, [1, 3, 5], 0, 55),
          },
          {
            key: "review",
            title: "复习",
            // Task-level trigger: fires every 3 days from the start day.
            trigger: {
              rule: { mode: "daily", interval: 3 },
              startsAt: offset(start, 0),
              endsAt: offset(start, 60),
            },
          },
        ],
      },
    ],
  }
}
