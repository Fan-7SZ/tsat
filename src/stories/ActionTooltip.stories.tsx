import type { Meta, StoryObj } from "@storybook/react-vite"
import { Pencil, Trash2 } from "lucide-react"
import { userEvent, within } from "storybook/test"

import { ActionTooltip } from "@/components/shared/ActionTooltip"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

const meta = {
  title: "Shared/ActionTooltip",
  component: ActionTooltip,
  parameters: { layout: "centered" },
  args: {
    label: "Edit",
    children: null,
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ActionTooltip>

export default meta
type Story = StoryObj<typeof meta>

/** Wrapping an icon button — the common case in row action bars. */
export const OnIconButton: Story = {
  render: () => (
    <div className="p-6">
      <ActionTooltip label="Edit">
        <Button variant="ghost" size="icon" aria-label="Edit">
          <Pencil />
        </Button>
      </ActionTooltip>
    </div>
  ),
}

/** Any focusable element works as long as it forwards refs, e.g. a checkbox. */
export const OnCheckbox: Story = {
  render: () => (
    <div className="p-6">
      <ActionTooltip label="Mark as done">
        <Checkbox aria-label="Mark as done" />
      </ActionTooltip>
    </div>
  ),
}

/** Tooltip revealed by keyboard focus. */
export const Open: Story = {
  render: () => (
    <div className="p-6">
      <ActionTooltip label="Delete">
        <Button variant="ghost" size="icon" aria-label="Delete">
          <Trash2 />
        </Button>
      </ActionTooltip>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    const body = within(canvasElement.ownerDocument.body)
    await body.findAllByText("Delete", undefined, { timeout: 3000 })
  },
}
