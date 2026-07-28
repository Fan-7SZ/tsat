import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { TooltipProvider } from "@/components/ui/tooltip"
import { GanttBar } from "@/components/gantt/GanttBar"
import { GanttContent } from "@/components/gantt/GanttContent"
import { GanttProvider } from "@/components/gantt/GanttProvider"
import { GanttRow } from "@/components/gantt/GanttRow"
import { intervalsOverlap } from "@/components/gantt/gantt-geometry"
import type { PlannerBlock } from "@/store/planner-state-store"

const ROW_COLORS: Record<string, string | undefined> = {
  "row-a": "#6366f1",
  "row-b": "#ec4899",
}

/**
 * Two task tracks under one shared ruler. Exercised here:
 * - click an empty spot → default-duration block; drag → sized block
 * - drag a block along its row to move, onto the other row to re-home
 * - drag the edges to resize (snaps to the zoom step)
 * - overlapping blocks on *different* rows get the conflict warning ring
 */
function Harness({
  initial,
}: {
  initial: Record<string, PlannerBlock[]>
}) {
  const [blocks, setBlocks] = useState(initial)

  const update = (rid: string, next: (list: PlannerBlock[]) => PlannerBlock[]) =>
    setBlocks((prev) => ({ ...prev, [rid]: next(prev[rid] ?? []) }))

  // Same double-booking rule GanttPanel derives: blocks on different rows
  // whose spans overlap are flagged, not prevented.
  const conflictIds = new Set<string>()
  const all = Object.entries(blocks).flatMap(([rid, list]) =>
    list.map((b) => ({ rid, ...b }))
  )
  for (const a of all)
    for (const b of all)
      if (a.rid !== b.rid && intervalsOverlap(a.from, a.to, b.from, b.to)) {
        conflictIds.add(a.id)
        conflictIds.add(b.id)
      }

  const moveBlock = (
    sourceRid: string,
    blockId: string,
    targetRid: string,
    from: number,
    to: number
  ) => {
    update(sourceRid, (list) => list.filter((b) => b.id !== blockId))
    update(targetRid, (list) => [...list, { id: blockId, from, to }])
  }

  return (
    <GanttProvider initialPx={1.5}>
      <TooltipProvider delayDuration={150}>
        <div className="h-64 overflow-hidden rounded-md border">
          <GanttContent>
            <GanttBar />
            <div className="pl-4">
              {Object.keys(ROW_COLORS).map((rid) => (
                <GanttRow
                  key={rid}
                  runtimeId={rid}
                  blocks={blocks[rid] ?? []}
                  color={ROW_COLORS[rid]}
                  defaultDuration={30}
                  conflictIds={conflictIds}
                  className="h-12"
                  onCreate={(from, to) =>
                    update(rid, (list) => [
                      ...list,
                      { id: crypto.randomUUID(), from, to },
                    ])
                  }
                  onBlockResize={(blockId, from, to) =>
                    update(rid, (list) =>
                      list.map((b) =>
                        b.id === blockId ? { ...b, from, to } : b
                      )
                    )
                  }
                  onBlockMove={(blockId, target, from, to) =>
                    moveBlock(rid, blockId, target, from, to)
                  }
                  onBlockRemove={(blockId) =>
                    update(rid, (list) => list.filter((b) => b.id !== blockId))
                  }
                />
              ))}
            </div>
          </GanttContent>
        </div>
      </TooltipProvider>
    </GanttProvider>
  )
}

const meta = {
  title: "Gantt/GanttRow",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta
type Story = StoryObj

/** Non-overlapping blocks — create/move/resize/remove across two rows. */
export const Interactive: Story = {
  render: () => (
    <Harness
      initial={{
        "row-a": [
          { id: "a1", from: 8 * 60, to: 9 * 60 },
          { id: "a2", from: 13 * 60, to: 14 * 60 + 30 },
        ],
        "row-b": [{ id: "b1", from: 10 * 60, to: 11 * 60 }],
      }}
    />
  ),
}

/** Double-booked time across rows — both blocks carry the warning ring. */
export const CrossRowConflict: Story = {
  render: () => (
    <Harness
      initial={{
        "row-a": [{ id: "a1", from: 9 * 60, to: 10 * 60 + 30 }],
        "row-b": [{ id: "b1", from: 9 * 60 + 45, to: 11 * 60 }],
      }}
    />
  ),
}
