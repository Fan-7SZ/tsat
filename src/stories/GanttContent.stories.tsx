import type { Meta, StoryObj } from "@storybook/react-vite"

import { GanttBar } from "@/components/gantt/GanttBar"
import { GanttContent } from "@/components/gantt/GanttContent"
import { GanttProvider } from "@/components/gantt/GanttProvider"
import {
  DEFAULT_PX_PER_MINUTE,
  MIN_PX_PER_MINUTE,
} from "@/components/gantt/gantt-geometry"
import { useGanttContext } from "@/components/gantt/use-gantt-context"

/**
 * `GanttContent` is the scroll viewport of the gantt canvas: it sizes its inner
 * surface to `contentWidthPx` (24h × zoom), zooms with ctrl/⌘ + wheel anchored
 * under the cursor, and pans with middle-button drag. Content inside positions
 * itself in minute space via the shared provider — here the ruler plus one
 * static demo span, so zooming visibly keeps ticks and span aligned.
 */
function DemoSpan({ from, to }: { from: number; to: number }) {
  const { px } = useGanttContext()
  return (
    <div className="relative mx-4 h-12">
      <div
        className="absolute top-1 bottom-1 flex items-center justify-center overflow-hidden rounded-md bg-primary/20 text-xs whitespace-nowrap text-primary"
        style={{ left: from * px, width: (to - from) * px }}
      >
        9:00 – 11:00
      </div>
    </div>
  )
}

function Framed({ px }: { px: number }) {
  return (
    <GanttProvider initialPx={px}>
      <div className="h-48 overflow-hidden rounded-md border">
        <GanttContent>
          <GanttBar />
          <DemoSpan from={9 * 60} to={11 * 60} />
        </GanttContent>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Ctrl/⌘ + wheel zooms around the cursor; middle-drag pans.
      </p>
    </GanttProvider>
  )
}

const meta = {
  title: "Gantt/GanttContent",
  component: GanttContent,
  parameters: { layout: "padded" },
} satisfies Meta<typeof GanttContent>

export default meta
type Story = StoryObj<typeof meta>

/** Default zoom — the day is wider than the frame, so the canvas scrolls. */
export const Default: Story = {
  render: () => <Framed px={DEFAULT_PX_PER_MINUTE} />,
}

/** Coarsest zoom — the whole 24h fits, nothing to scroll. */
export const ZoomedOut: Story = {
  render: () => <Framed px={MIN_PX_PER_MINUTE} />,
}
