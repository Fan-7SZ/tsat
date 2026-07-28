import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { AboutDialog } from "@/components/dialogs/AboutDialog"
import { Button } from "@/components/ui/button"

function Harness() {
  const [shown, setShown] = useState(true)
  return (
    <div className="p-6">
      <Button variant="outline" onClick={() => setShown(true)}>
        About TSAT
      </Button>
      <AboutDialog shown={shown} setShown={setShown} />
    </div>
  )
}

/**
 * Static about card: app icon, version (injected at build time), GitHub link
 * and credits. One state only.
 */
const meta = {
  title: "Dialogs/AboutDialog",
  component: AboutDialog,
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: 480 } },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AboutDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { shown: true, setShown: () => {} },
  render: () => <Harness />,
}
