import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { GanttPanel, type GanttPanelRow } from "@/components/gantt/GanttPanel"
import type { PlannerBlock } from "@/store/planner-state-store"

const ROWS: GanttPanelRow[] = [
  { runtimeId: "t1", taskId: "t1", title: "写周报", goalTitle: "本周目标", color: "#6366f1", estimatedDuration: 120 },
  { runtimeId: "t2", taskId: "t2", title: "健身", goalTitle: "健康", color: "#ec4899", estimatedDuration: 45 },
  { runtimeId: "t3", taskId: "t3", title: "Review PRs", goalTitle: "工程", color: "#14b8a6", estimatedDuration: 30 },
  { runtimeId: "t4", taskId: "t4", title: "无目标任务" },
  { runtimeId: "t5", taskId: "t5", title: "读论文", goalTitle: "科研", color: "#f97316", estimatedDuration: 90 },
]

const INITIAL: Record<string, PlannerBlock[]> = {
  t1: [{ id: "b1", from: 8 * 60, to: 9 * 60 }],
  t3: [
    { id: "b2", from: 9 * 60 + 30, to: 10 * 60 },
    { id: "b3", from: 14 * 60, to: 14 * 60 + 45 },
  ],
}

/**
 * In-memory harness mirroring what PlannerDialog wires to the planner-state
 * store. Verify: drag-create on an empty track, multiple blocks per row, drag a
 * block to move (same row = reposition, onto another row = re-home), resize via
 * the edges (snaps to the zoom step), the time tooltip during a gesture, the
 * label's `scheduled / estimated` readout, and ctrl/⌘ + wheel zoom keeping ticks
 * and blocks aligned.
 */
function Harness() {
  const [blocks, setBlocks] = useState<Record<string, PlannerBlock[]>>(INITIAL)

  const onCreate = (rid: string, from: number, to: number) =>
    setBlocks((p) => ({
      ...p,
      [rid]: [...(p[rid] ?? []), { id: crypto.randomUUID(), from, to }],
    }))

  const onResize = (rid: string, bid: string, from: number, to: number) =>
    setBlocks((p) => ({
      ...p,
      [rid]: (p[rid] ?? []).map((b) => (b.id === bid ? { ...b, from, to } : b)),
    }))

  const onRemove = (rid: string, bid: string) =>
    setBlocks((p) => {
      const next = (p[rid] ?? []).filter((b) => b.id !== bid)
      const out = { ...p }
      if (next.length) out[rid] = next
      else delete out[rid]
      return out
    })

  return (
    <GanttPanel
      rows={ROWS}
      blocksByRuntime={blocks}
      onCreate={onCreate}
      onResize={onResize}
      onRemove={onRemove}
      initialPx={2}
    />
  )
}

const meta = {
  title: "Gantt/GanttPanel",
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="h-150 w-225 overflow-hidden rounded-xl border bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta

export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => <Harness />,
}
