import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { ChecklistDialog } from "@/components/dialogs/ChecklistDialog"
import { Button } from "@/components/ui/button"

type StepRow = { id: string; title: string; done: boolean }

const STEPS: StepRow[] = [
  { id: "s1", title: "Draft the outline", done: true },
  { id: "s2", title: "Write the first section", done: true },
  { id: "s3", title: "Review and edit", done: false },
  { id: "s4", title: "Publish", done: false },
]

/**
 * Guard shown before a task with steps can be marked done: every step must be
 * checked before the confirm button unlocks. Toggles are mirrored back to the
 * parent via `onStepsChange` (here: local state, logged as the checked ids).
 */
function Harness({ initialSteps }: { initialSteps: StepRow[] }) {
  const [open, setOpen] = useState(true)
  const [steps, setSteps] = useState(initialSteps)

  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)}>Mark task done…</Button>
      <ChecklistDialog
        open={open}
        onOpenChange={setOpen}
        steps={steps}
        onConfirm={() => {}}
        onStepsChange={(completedStepIds) =>
          setSteps((prev) =>
            prev.map((s) => ({ ...s, done: completedStepIds.includes(s.id) }))
          )
        }
      />
    </div>
  )
}

const meta = {
  title: "Dialogs/ChecklistDialog",
  component: ChecklistDialog,
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: 560 } },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChecklistDialog>

export default meta
type Story = StoryObj<typeof meta>

const noopArgs = {
  open: true,
  onOpenChange: () => {},
  steps: [],
  onConfirm: () => {},
}

/** Half the steps checked — confirm stays disabled until all are done. */
export const PartiallyChecked: Story = {
  args: noopArgs,
  render: () => <Harness initialSteps={STEPS} />,
}

/** Nothing checked yet. */
export const AllUnchecked: Story = {
  args: noopArgs,
  render: () => (
    <Harness initialSteps={STEPS.map((s) => ({ ...s, done: false }))} />
  ),
}

/** Every step checked — confirm is enabled. */
export const AllChecked: Story = {
  args: noopArgs,
  render: () => (
    <Harness initialSteps={STEPS.map((s) => ({ ...s, done: true }))} />
  ),
}

/** Degenerate empty list: nothing to check, confirm stays disabled. */
export const EmptySteps: Story = {
  args: noopArgs,
  render: () => <Harness initialSteps={[]} />,
}
