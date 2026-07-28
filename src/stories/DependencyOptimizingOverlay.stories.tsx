import type { Meta, StoryObj } from "@storybook/react-vite"

import { DependencyOptimizingOverlay } from "@/components/flow/DependencyOptimizingOverlay"

/**
 * Busy mask rendered over the FlowPanel while an AI dependency optimization
 * runs. The parent must be `relative`; the placeholder boxes below stand in
 * for the flow graph so the blur/dim reads correctly.
 */
const meta = {
  title: "Flow/DependencyOptimizingOverlay",
  component: DependencyOptimizingOverlay,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof DependencyOptimizingOverlay>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="relative h-64 w-96 overflow-hidden rounded-xl border bg-background p-4">
      {/* stand-in flow nodes behind the mask */}
      <div className="flex flex-col gap-3">
        <div className="w-40 rounded-md border bg-card px-3 py-2 text-sm">
          Design schema
        </div>
        <div className="ml-16 w-40 rounded-md border bg-card px-3 py-2 text-sm">
          Build API
        </div>
        <div className="ml-32 w-40 rounded-md border bg-card px-3 py-2 text-sm">
          Wire up UI
        </div>
      </div>
      <DependencyOptimizingOverlay />
    </div>
  ),
}
