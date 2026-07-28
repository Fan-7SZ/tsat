import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import {
  SettingsDialog,
  type SettingsTab,
} from "@/components/dialogs/SettingsDialog"
import { Button } from "@/components/ui/button"

/**
 * Tabs render lazily, so `defaultTab` picks which panel each story mounts.
 * General / planner / AI read and write the real (Storybook-local) app store;
 * the sync tab mounts with no provider bound, showing only the provider
 * selector — full sync states live in the SyncSettingsPanel stories.
 */
function Harness({ defaultTab }: { defaultTab: SettingsTab }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="p-6">
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open settings
      </Button>
      <SettingsDialog open={open} onOpenChange={setOpen} defaultTab={defaultTab} />
    </div>
  )
}

const meta = {
  title: "Dialogs/SettingsDialog",
  component: SettingsDialog,
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: 720 } },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SettingsDialog>

export default meta
type Story = StoryObj<typeof meta>

const noopArgs = { open: true, onOpenChange: () => {} }

/** Language + theme selectors. */
export const GeneralTab: Story = {
  args: noopArgs,
  render: () => <Harness defaultTab="general" />,
}

/** Daily capacity and the forced-todo / forced-focus thresholds. */
export const PlannerTab: Story = {
  args: noopArgs,
  render: () => <Harness defaultTab="planner" />,
}

/** Provider picker with conditional OpenRouter / DeepSeek credential fields. */
export const AiTab: Story = {
  args: noopArgs,
  render: () => <Harness defaultTab="ai" />,
}

/** Sync tab with no provider bound yet (worker-backed states are mocked in SyncSettingsPanel stories). */
export const SyncTab: Story = {
  args: noopArgs,
  render: () => <Harness defaultTab="sync" />,
}
