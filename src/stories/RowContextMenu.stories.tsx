import type { Meta, StoryObj } from "@storybook/react-vite"
import { ExternalLink, Trash2 } from "lucide-react"
import { fireEvent, userEvent, within } from "storybook/test"

import {
  RowContextMenuProvider,
  RowMenuButton,
} from "@/components/shared/row-context-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

/**
 * A list row wired the way the app uses it: the ContextMenuTrigger binds to the
 * row container, and the visible "⋮" button re-dispatches a `contextmenu` event
 * so both right-click and the button open the exact same menu.
 */
function DemoRow() {
  return (
    <RowContextMenuProvider>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            data-testid="demo-row"
            className="flex w-80 items-center justify-between gap-2 rounded-md border p-3"
          >
            <div className="flex min-w-0 flex-col">
              <span className="paragraph-small-medium truncate">
                Weekly review
              </span>
              <span className="paragraph-mini text-muted-foreground">
                Right-click the row or use the button
              </span>
            </div>
            <RowMenuButton size="icon-sm" />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuGroup>
            <ContextMenuItem>
              <ExternalLink />
              View details
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuItem variant="destructive">
              <Trash2 />
              Delete
            </ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
    </RowContextMenuProvider>
  )
}

const meta = {
  title: "Shared/RowContextMenu",
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 360 } },
  },
  tags: ["autodocs"],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** Closed state — the "⋮" affordance sits at the row's trailing edge. */
export const Default: Story = {
  render: () => <DemoRow />,
}

/** Left-clicking the "⋮" button opens the row's context menu. */
export const OpenedByButton: Story = {
  render: () => <DemoRow />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole("button"))
    // The menu opens after a queued re-dispatch and portals to the body.
    const body = within(canvasElement.ownerDocument.body)
    await body.findAllByRole("menuitem")
  },
}

/** Right-clicking anywhere on the row opens the same menu. */
export const OpenedByRightClick: Story = {
  render: () => <DemoRow />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    fireEvent.contextMenu(await canvas.findByTestId("demo-row"))
    const body = within(canvasElement.ownerDocument.body)
    await body.findAllByRole("menuitem")
  },
}
