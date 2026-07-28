import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import {
  TaskRunsDialog,
  type TaskRunRow,
} from "@/components/task/TaskRunsDialog"
import type { TaskRuntimeStatus } from "@/domain/entities/TaskRuntimeEntity"
import type { TaskRuntimeID } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import { Button } from "@/components/ui/button"

const rid = (value: string) => value as TaskRuntimeID
const dateKey = (value: string) => value as LocalDateKey

/**
 * Counter task: several interchangeable runs of the same task today. Every row
 * is labeled by how it was pulled in, its trailing action is plain removal, and
 * "run again" is offered while the occurrence budget has room.
 */
const COUNTER_RUNS: TaskRunRow[] = [
  { runtimeId: rid("run-1"), label: "Run 1", status: "done", trailing: { kind: "remove" } },
  { runtimeId: rid("run-2"), label: "Run 2", status: "inProgress", trailing: { kind: "remove" } },
  { runtimeId: rid("run-3"), label: "Run 3", status: "todo", trailing: { kind: "remove" } },
]

/**
 * Repeat task: each run serves a specific occurrence date, so rows are not
 * interchangeable. Today's point can be skipped; an overdue point (repeat debt)
 * opens the resolve/ignore popover instead.
 */
const REPEAT_RUNS: TaskRunRow[] = [
  {
    runtimeId: rid("run-debt-1"),
    label: "2026-07-24",
    status: "todo",
    trailing: { kind: "debt", plannedForDate: dateKey("2026-07-24") },
  },
  {
    runtimeId: rid("run-debt-2"),
    label: "2026-07-25",
    status: "todo",
    trailing: { kind: "debt", plannedForDate: dateKey("2026-07-25") },
  },
  {
    runtimeId: rid("run-today"),
    label: "2026-07-26 (today)",
    status: "inProgress",
    trailing: { kind: "skip" },
  },
]

function Harness({
  initialRuns,
  withAddRun,
}: {
  initialRuns: TaskRunRow[]
  withAddRun?: boolean
}) {
  const [open, setOpen] = useState(true)
  const [runs, setRuns] = useState(initialRuns)

  const changeStatus = (runtimeId: TaskRuntimeID, status: TaskRuntimeStatus) =>
    setRuns((prev) =>
      prev.map((r) => (r.runtimeId === runtimeId ? { ...r, status } : r))
    )

  const drop = (runtimeId: TaskRuntimeID) =>
    setRuns((prev) => prev.filter((r) => r.runtimeId !== runtimeId))

  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)}>Open runs dialog</Button>
      <TaskRunsDialog
        open={open}
        onOpenChange={setOpen}
        runs={runs}
        onChangeStatus={changeStatus}
        onRemove={drop}
        onSkip={drop}
        onResolveDebt={(runtimeId, resolution) =>
          resolution === "done"
            ? changeStatus(runtimeId, "done")
            : drop(runtimeId)
        }
        onAddRun={
          withAddRun
            ? () =>
                setRuns((prev) => [
                  ...prev,
                  {
                    runtimeId: rid(crypto.randomUUID()),
                    label: `Run ${prev.length + 1}`,
                    status: "todo",
                    trailing: { kind: "remove" },
                  },
                ])
            : undefined
        }
      />
    </div>
  )
}

const meta = {
  title: "Task/TaskRunsDialog",
  component: TaskRunsDialog,
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: 640 } },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TaskRunsDialog>

export default meta
type Story = StoryObj<typeof meta>

const noopArgs = {
  open: true,
  onOpenChange: () => {},
  runs: [],
  onChangeStatus: () => {},
  onRemove: () => {},
  onSkip: () => {},
  onResolveDebt: () => {},
}

/** Interchangeable counter runs: removable rows plus the "run again" button. */
export const CounterRuns: Story = {
  args: noopArgs,
  render: () => <Harness initialRuns={COUNTER_RUNS} withAddRun />,
}

/** Date-bound repeat runs: today's point skips, overdue debt points resolve. */
export const RepeatRuns: Story = {
  args: noopArgs,
  render: () => <Harness initialRuns={REPEAT_RUNS} />,
}
