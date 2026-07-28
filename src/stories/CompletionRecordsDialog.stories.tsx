import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import {
  CompletionRecordsDialog,
  type CompletionRecordRow,
  type RepeatPointRow,
} from "@/components/task/CompletionRecordsDialog"
import type { RepeatPointStatus } from "@/domain/entities/RepeatLedgerEntity"
import { Button } from "@/components/ui/button"

const todayKey = () => new Date().toISOString().slice(0, 10)

function EditableHarness() {
  const [open, setOpen] = useState(true)
  const [records, setRecords] = useState<CompletionRecordRow[]>([
    { id: "r1", date: "2026-06-09" },
    { id: "r2", date: "2026-06-11" },
  ])

  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)}>Open records dialog</Button>
      <CompletionRecordsDialog
        open={open}
        onOpenChange={setOpen}
        mode="records"
        records={records}
        onQuickAddToday={() =>
          setRecords((rs) => [
            ...rs,
            { id: crypto.randomUUID(), date: todayKey() },
          ])
        }
        onAddRow={() =>
          setRecords((rs) => [...rs, { id: crypto.randomUUID(), date: "" }])
        }
        onRemoveRow={(id) =>
          setRecords((rs) => rs.filter((r) => r.id !== id))
        }
        onChangeDate={(id, date) =>
          setRecords((rs) =>
            rs.map((r) => (r.id === id ? { ...r, date } : r))
          )
        }
      />
    </div>
  )
}

function RepeatHarness() {
  const [open, setOpen] = useState(true)
  const [points, setPoints] = useState<RepeatPointRow[]>([
    { dateKey: "2026-06-09", status: "completed" },
    { dateKey: "2026-06-10", status: "skipped" },
    { dateKey: "2026-06-11", status: "planned" },
    { dateKey: "2026-06-12", status: "planned" },
  ])

  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)}>Open repeat dialog</Button>
      <CompletionRecordsDialog
        open={open}
        onOpenChange={setOpen}
        mode="repeat"
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

const meta = {
  title: "Task/CompletionRecordsDialog",
  component: CompletionRecordsDialog,
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: 640 } },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CompletionRecordsDialog>

export default meta
type Story = StoryObj<typeof meta>

export const EditableRecords: Story = {
  args: { open: true, onOpenChange: () => {}, mode: "records" },
  render: () => <EditableHarness />,
}

export const RepeatPoints: Story = {
  args: { open: true, onOpenChange: () => {}, mode: "repeat" },
  render: () => <RepeatHarness />,
}
