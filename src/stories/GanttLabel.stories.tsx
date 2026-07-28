import type { Meta, StoryObj } from "@storybook/react-vite"
import { GanttLabel } from "@/components/gantt/GanttLabel"

const meta = {
  title: "Gantt/GanttLabel",
  component: GanttLabel,
  parameters: { layout: "centered" },
  args: {
    title: "写周报",
    goaltitle: "本周目标",
    scheduledMinutes: 90,
    estimatedDuration: 120,
  },
} satisfies Meta<typeof GanttLabel>

export default meta
type Story = StoryObj<typeof meta>

/** With a goal color: outline border + lightened tint. */
export const WithColor: Story = {
  args: { color: "#6366f1" },
}

/** No color → default shadcn Item style (fallback). */
export const NoColor: Story = {}

/** No estimate → only the scheduled total shows (no `/ …`). */
export const NoEstimate: Story = {
  args: { estimatedDuration: undefined },
}

/** Nothing scheduled and no estimate → the readout is hidden entirely. */
export const NoReadout: Story = {
  args: { scheduledMinutes: 0, estimatedDuration: undefined },
}

const COLORS = ["#6366f1", "#14b8a6", "#f97316", "#ec4899", "#84cc16"]

/** Color variants side by side, plus the no-color fallback. */
export const Matrix: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      {COLORS.map((c, i) => (
        <GanttLabel
          key={c}
          title={`任务 ${i + 1}`}
          goaltitle="某目标"
          color={c}
          scheduledMinutes={(i + 1) * 30}
          estimatedDuration={120}
        />
      ))}
      <GanttLabel title="无颜色" goaltitle="默认风格" scheduledMinutes={0} />
    </div>
  ),
}
