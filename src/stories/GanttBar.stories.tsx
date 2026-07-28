import type { Meta, StoryObj } from "@storybook/react-vite"
import { GanttBar } from "@/components/gantt/GanttBar"
import { GanttProvider } from "@/components/gantt/GanttProvider"
import {
  DEFAULT_PX_PER_MINUTE,
  MIN_PX_PER_MINUTE,
} from "@/components/gantt/gantt-geometry"

/**
 * The ruler spans the whole day; tick density is driven by the shared zoom
 * (`px`, px-per-minute) from `GanttProvider`, not a from/to window. Higher
 * `initialPx` → finer labels (hour → `H:MM`) and a wider card. The wrapper is
 * `w-fit` (shrink-to-content), so the card's border always renders in full — at
 * high zoom the card is wider than the viewport and the canvas scrolls.
 */
function Framed({ px }: { px: number }) {
  return (
    <GanttProvider initialPx={px}>
      <div className="w-fit">
        <GanttBar />
      </div>
    </GanttProvider>
  )
}

const meta = {
  title: "Gantt/GanttBar",
  component: GanttBar,
  parameters: { layout: "padded" },
} satisfies Meta<typeof GanttBar>

export default meta
type Story = StoryObj<typeof meta>

/** Coarsest zoom — the whole 24h fits without scrolling. */
export const FullDay: Story = {
  render: () => <Framed px={MIN_PX_PER_MINUTE} />,
}

/** Default zoom — hourly labels; card runs wider than the viewport. */
export const Default: Story = {
  render: () => <Framed px={DEFAULT_PX_PER_MINUTE} />,
}

/** Zoomed in — labels drill down to minutes; scroll the canvas to pan. */
export const ZoomedIn: Story = {
  render: () => <Framed px={4} />,
}
