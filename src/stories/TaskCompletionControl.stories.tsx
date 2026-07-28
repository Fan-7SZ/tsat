import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  Play,
  Check,
  RotateCcw,
  CalendarPlus,
  CalendarMinus,
  SkipForward,
  ListChecks,
  Trash,
} from "lucide-react"

import {
  TaskCompletionControl,
  type CompletionActionItem,
  type CompletionPrimaryAction,
} from "@/components/task/TaskCompletionControl"
import {
  CompletionRecordsDialog,
  type CompletionRecordRow,
  type RepeatPointRow,
} from "@/components/task/CompletionRecordsDialog"
import type { RepeatPointStatus } from "@/domain/entities/RepeatLedgerEntity"
import { Button } from "@/components/ui/button"

const noop = () => {}

// ── Action presets mirroring the task-detail action model ──
const playPrimary: CompletionPrimaryAction = {
  key: "play",
  label: "加入处理队列",
  icon: <Play />,
  tone: "neutral",
  onSelect: noop,
}
const donePrimary: CompletionPrimaryAction = {
  key: "done",
  label: "标记为完成",
  icon: <Check />,
  tone: "neutral",
  onSelect: noop,
}
const undoPrimary: CompletionPrimaryAction = {
  key: "undo",
  label: "撤销完成",
  icon: <RotateCcw />,
  tone: "done",
  onSelect: noop,
}
const addTodayPrimary: CompletionPrimaryAction = {
  key: "addToday",
  label: "加入今日 todo",
  icon: <CalendarPlus />,
  tone: "neutral",
  onSelect: noop,
}

const customRecords: CompletionActionItem = {
  key: "records",
  label: "自定义完成情况",
  icon: <ListChecks />,
  onSelect: noop,
}
const removeToday: CompletionActionItem = {
  key: "remove",
  label: "移出今日 todo",
  icon: <CalendarMinus />,
  variant: "destructive",
  onSelect: noop,
}
const skipPlan: CompletionActionItem = {
  key: "skip",
  label: "跳过计划条目",
  icon: <SkipForward />,
  onSelect: noop,
}
const markDoneDirect: CompletionActionItem = {
  key: "markDone",
  label: "标记为完成",
  icon: <Check />,
  onSelect: noop,
}

interface Scenario {
  title: string
  primary: CompletionPrimaryAction
  secondary?: CompletionActionItem[]
}

// One row per applicable cell/status of the design table. Note: a `done`
// runtime never offers 移出/跳过 — it is reverted via the primary 撤销完成.
const scenarios: Scenario[] = [
  { title: "plain c=1 · 在 todo", primary: playPrimary, secondary: [removeToday] },
  { title: "plain c=1 · 在 inProgress", primary: donePrimary, secondary: [removeToday] },
  { title: "plain c=1 · 在 done", primary: undoPrimary, secondary: [] },
  { title: "plain c=1 · 不在 runtime", primary: addTodayPrimary, secondary: [markDoneDirect] },
  { title: "plain c>1 · 在 todo", primary: playPrimary, secondary: [customRecords, removeToday] },
  { title: "plain c>1 · 在 done", primary: undoPrimary, secondary: [customRecords] },
  { title: "plain c>1 · 不在 runtime", primary: addTodayPrimary, secondary: [customRecords] },
  { title: "repeat · 在 todo(计划点拉起)", primary: playPrimary, secondary: [customRecords, skipPlan] },
  { title: "repeat · 在 done(计划点拉起)", primary: undoPrimary, secondary: [customRecords] },
  { title: "repeat · 不在 runtime(手动拉起)", primary: addTodayPrimary, secondary: [customRecords] },
  { title: "trigger · 在 inProgress", primary: donePrimary, secondary: [customRecords, removeToday] },
  { title: "trigger · 不在 runtime", primary: addTodayPrimary, secondary: [customRecords] },
]

const meta = {
  title: "Task/TaskCompletionControl",
  component: TaskCompletionControl,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof TaskCompletionControl>

export default meta
type Story = StoryObj<typeof meta>

/** All table cells at a glance. */
export const Matrix: Story = {
  args: { primary: donePrimary },
  render: () => (
    <div className="flex flex-col gap-4 p-6">
      {scenarios.map((s) => (
        <div key={s.title} className="flex items-center gap-3">
          <span className="paragraph-small w-64 text-muted-foreground">
            {s.title}
          </span>
          <TaskCompletionControl
            primary={s.primary}
            secondary={s.secondary}
            menuLabel="更多操作"
          />
        </div>
      ))}
    </div>
  ),
}

export const PrimaryOnly: Story = {
  args: { primary: donePrimary },
  render: () => <TaskCompletionControl primary={donePrimary} />,
}

export const DoneTone: Story = {
  args: { primary: undoPrimary },
  render: () => (
    <TaskCompletionControl primary={undoPrimary} secondary={[removeToday]} />
  ),
}

/** Dropdown "自定义完成情况" opens the records dialog (both modes). */
function RecordsHarness({ mode }: { mode: "records" | "repeat" }) {
  const [open, setOpen] = useState(false)
  const [records, setRecords] = useState<CompletionRecordRow[]>([
    { id: "r1", date: "2026-06-09" },
    { id: "r2", date: "2026-06-11" },
  ])
  const [points, setPoints] = useState<RepeatPointRow[]>([
    { dateKey: "2026-06-09", status: "completed" },
    { dateKey: "2026-06-10", status: "skipped" },
    { dateKey: "2026-06-11", status: "planned" },
  ])

  return (
    <div className="flex items-center gap-2 p-6">
      <TaskCompletionControl
        primary={donePrimary}
        secondary={[{ ...customRecords, onSelect: () => setOpen(true) }]}
        menuLabel="更多操作"
      />
      <Button variant="destructive" size="icon">
        <Trash />
      </Button>
      <CompletionRecordsDialog
        open={open}
        onOpenChange={setOpen}
        mode={mode}
        records={records}
        onQuickAddToday={() =>
          setRecords((rs) => [
            ...rs,
            { id: crypto.randomUUID(), date: "2026-06-12" },
          ])
        }
        onAddRow={() =>
          setRecords((rs) => [...rs, { id: crypto.randomUUID(), date: "" }])
        }
        onRemoveRow={(id) => setRecords((rs) => rs.filter((r) => r.id !== id))}
        onChangeDate={(id, date) =>
          setRecords((rs) => rs.map((r) => (r.id === id ? { ...r, date } : r)))
        }
        points={points}
        onChangeStatus={(dateKey, status: RepeatPointStatus) =>
          setPoints((ps) =>
            ps.map((p) => (p.dateKey === dateKey ? { ...p, status } : p))
          )
        }
      />
    </div>
  )
}

export const RecordsMode: Story = {
  args: { primary: donePrimary },
  render: () => <RecordsHarness mode="records" />,
}

export const RepeatMode: Story = {
  args: { primary: donePrimary },
  render: () => <RecordsHarness mode="repeat" />,
}
