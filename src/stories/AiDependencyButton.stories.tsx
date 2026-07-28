import type { Meta, StoryObj } from "@storybook/react-vite"

import { AiDependencyButton } from "@/components/flow/AiDependencyButton"

/**
 * Toolbar entry point that summons the dependency-optimize popover (see the
 * DependencyAssistPopover stories for the full flow). Spreads Button props so
 * it can act as a Popover/Tooltip `asChild` trigger.
 */
const meta = {
  title: "Flow/AiDependencyButton",
  component: AiDependencyButton,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof AiDependencyButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Disabled while an optimization is already running. */
export const Disabled: Story = {
  args: { disabled: true },
}

/** As it sits in the FlowPanel toolbar next to Undo / Save. */
export const InToolbar: Story = {
  render: () => (
    <div className="flex items-center gap-2 rounded-lg border bg-card p-2">
      <AiDependencyButton />
      <div className="h-5 w-px bg-border" />
      <span className="text-xs text-muted-foreground">Undo · Save</span>
    </div>
  ),
}
