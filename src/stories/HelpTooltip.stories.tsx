import type { Meta, StoryObj } from "@storybook/react-vite"
import { userEvent, within } from "storybook/test"

import { HelpTooltip } from "@/components/shared/HelpTooltip"

const CONTENT =
  "Debt counts the repeat occurrences you missed; they are re-planned onto the following days."

const meta = {
  title: "Shared/HelpTooltip",
  component: HelpTooltip,
  parameters: { layout: "centered" },
  args: {
    content: CONTENT,
    label: "What is repeat debt?",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof HelpTooltip>

export default meta
type Story = StoryObj<typeof meta>

/** The icon button as it sits next to a field label. */
export const Default: Story = {
  render: (args) => (
    <div className="flex items-center gap-1 p-6">
      <span className="paragraph-small-medium">Repeat debt</span>
      <HelpTooltip {...args} />
    </div>
  ),
}

/** Keyboard focus reveals the tooltip (same content as hover). */
export const Open: Story = {
  render: (args) => (
    <div className="flex items-center gap-1 p-6">
      <span className="paragraph-small-medium">Repeat debt</span>
      <HelpTooltip {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Focus via keyboard so the tooltip opens without the hover delay.
    await userEvent.tab()
    const body = within(canvasElement.ownerDocument.body)
    await body.findAllByText(CONTENT, undefined, { timeout: 3000 })
  },
}
