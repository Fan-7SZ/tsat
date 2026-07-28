import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router"
import { fireEvent, userEvent, waitFor, within } from "storybook/test"

import { DetailDeleteContextMenu } from "@/components/contextMenus/DetailDeleteContextMenu"

function Harness() {
  return (
    <div className="p-6">
      <DetailDeleteContextMenu
        detailPath="/goals/goal-1"
        deleteTitle="Delete this goal?"
        deleteDescription="The goal and its tasks will be removed. This cannot be undone."
        onDelete={() => {}}
      >
        <div
          data-testid="detail-row"
          className="w-80 rounded-md border p-4 paragraph-small text-muted-foreground"
        >
          Right-click this row
        </div>
      </DetailDeleteContextMenu>
    </div>
  )
}

const meta = {
  title: "ContextMenus/DetailDeleteContextMenu",
  component: DetailDeleteContextMenu,
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 400 } },
  },
  args: {
    detailPath: "/goals/goal-1",
    deleteTitle: "Delete this goal?",
    deleteDescription:
      "The goal and its tasks will be removed. This cannot be undone.",
    onDelete: () => {},
    children: null,
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof DetailDeleteContextMenu>

export default meta
type Story = StoryObj<typeof meta>

/** Closed state — any row content can be wrapped. */
export const Default: Story = {
  render: () => <Harness />,
}

/** Menu open: "view details" plus the destructive delete entry. */
export const MenuOpen: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    fireEvent.contextMenu(await canvas.findByTestId("detail-row"))
    const body = within(canvasElement.ownerDocument.body)
    await body.findAllByRole("menuitem")
  },
}

/** Choosing delete opens the confirm dialog with the provided copy. */
export const DeleteConfirmOpen: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    fireEvent.contextMenu(await canvas.findByTestId("detail-row"))
    const body = within(canvasElement.ownerDocument.body)
    const items = await body.findAllByRole("menuitem")
    // The destructive delete entry is the last menu item.
    await userEvent.click(items[items.length - 1])
    await waitFor(async () => {
      await body.findByText("Delete this goal?")
    })
  },
}
