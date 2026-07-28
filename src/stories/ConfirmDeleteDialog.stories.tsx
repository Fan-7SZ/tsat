import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { ConfirmDeleteDialog } from "@/components/dialogs/ConfirmDeleteDialog"
import { Button } from "@/components/ui/button"

function Harness({
  title,
  description,
  confirmLabel,
}: {
  title?: string
  description?: string
  confirmLabel?: string
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="p-6">
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete…
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        onConfirm={() => {}}
      />
    </div>
  )
}

const meta = {
  title: "Dialogs/ConfirmDeleteDialog",
  component: ConfirmDeleteDialog,
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: 480 } },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ConfirmDeleteDialog>

export default meta
type Story = StoryObj<typeof meta>

const noopArgs = { open: true, onOpenChange: () => {}, onConfirm: () => {} }

/** No copy passed in — falls back to the i18n default title/description. */
export const DefaultCopy: Story = {
  args: noopArgs,
  render: () => <Harness />,
}

/** Caller-provided title and description for a specific entity. */
export const CustomCopy: Story = {
  args: noopArgs,
  render: () => (
    <Harness
      title={'Delete goal "Ship v1"?'}
      description="The goal and all 12 tasks under it will be removed. This cannot be undone."
    />
  ),
}

/** Custom confirm label for non-delete destructive confirmations. */
export const CustomConfirmLabel: Story = {
  args: noopArgs,
  render: () => (
    <Harness
      title="Unbind task from goal?"
      description="The task keeps its history but leaves the goal's dependency tree."
      confirmLabel="Unbind"
    />
  ),
}
