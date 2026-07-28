import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { GanttProvider } from "@/components/gantt/GanttProvider"
import { GanttContent } from "@/components/gantt/GanttContent"
import { GanttBar } from "@/components/gantt/GanttBar"
import { GanttBlock } from "@/components/gantt/GanttBlock"
import { useGanttContext } from "@/components/gantt/use-gantt-context"

/**
 * Interactive playground for the px-based gantt: ruler (`GanttBar`) and a block
 * (`GanttBlock`) share one `GanttProvider`, so zoom drives both. Verify here:
 * - **Zoom** with the buttons (or ctrl/⌘ + scroll) — ticks re-densify and the
 *   block keeps its minute span while its pixel width tracks `px`.
 * - **Resize** by dragging the block's left/right edges — it snaps to `step`,
 *   which itself coarsens/refines with zoom.
 * - Middle-drag or scroll the surface to pan.
 */
function ZoomToolbar() {
  const { px, step, labelStep, zoomBy } = useGanttContext()
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <button
        className="rounded border px-2 py-0.5"
        onClick={() => zoomBy(1 / 1.2)}
      >
        −
      </button>
      <button
        className="rounded border px-2 py-0.5"
        onClick={() => zoomBy(1.2)}
      >
        +
      </button>
      <span className="tabular-nums">
        px/min {px.toFixed(2)} · snap {step}m · label {labelStep}m
      </span>
    </div>
  )
}

function Playground({ initialPx }: { initialPx: number }) {
  const [bar, setBar] = useState({ from: 9 * 60, to: 11 * 60 })
  return (
    <GanttProvider initialPx={initialPx}>
      {/* Isolated block: exercises move (same-row) + resize + zoom + tooltip.
          Cross-row move needs sibling rows with data-runtime-id (see GanttPanel). */}
      <TooltipProvider delayDuration={150}>
        <div className="flex flex-col gap-2">
          <ZoomToolbar />
          <span className="text-xs text-muted-foreground tabular-nums">
            block {Math.floor(bar.from / 60)}:
            {String(bar.from % 60).padStart(2, "0")} –{" "}
            {Math.floor(bar.to / 60)}:{String(bar.to % 60).padStart(2, "0")}
          </span>
          {/* Fixed-height framed viewport; GanttContent scrolls inside it, so
              the border always renders in full. */}
          <div className="h-48 overflow-hidden rounded-md border">
            <GanttContent>
              <GanttBar />
              {/* pl-4 mirrors CardContent's px-4 inside GanttBar, so the block
                  shares the ruler's origin and ticks line up with the bar. */}
              <div className="relative h-12 pl-4">
                <GanttBlock
                  runtimeId="demo"
                  from={bar.from}
                  to={bar.to}
                  neighbors={[]}
                  onValueChange={(from, to) => setBar({ from, to })}
                />
              </div>
            </GanttContent>
          </div>
        </div>
      </TooltipProvider>
    </GanttProvider>
  )
}

const meta = {
  title: "Gantt/GanttBlock",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta
type Story = StoryObj

/** Drag the block edges to resize; zoom to watch ticks + block stay aligned. */
export const Interactive: Story = {
  render: () => <Playground initialPx={2} />,
}
