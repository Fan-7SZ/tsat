import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router"

import { NavHistoryButtons } from "@/components/shared/NavHistoryButtons"
import { useNavigationStore } from "@/store/navigation-store"

/**
 * Seeds the module-level navigation store synchronously (before the buttons
 * first render) so each story controls the back/forward availability.
 */
function Harness({
  entries,
  currentIndex,
}: {
  entries: string[]
  currentIndex: number
}) {
  useState(() => {
    useNavigationStore.setState({ entries, currentIndex, isRestoring: false })
    return null
  })
  return <NavHistoryButtons />
}

const meta = {
  title: "Shared/NavHistoryButtons",
  component: NavHistoryButtons,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof NavHistoryButtons>

export default meta
type Story = StoryObj<typeof meta>

/** Fresh session — a single history entry, both directions disabled. */
export const BothDisabled: Story = {
  render: () => <Harness entries={["/"]} currentIndex={0} />,
}

/** At the newest entry — only "back" is available. */
export const CanGoBack: Story = {
  render: () => <Harness entries={["/", "/goals"]} currentIndex={1} />,
}

/** After going back — only "forward" is available. */
export const CanGoForward: Story = {
  render: () => <Harness entries={["/", "/goals"]} currentIndex={0} />,
}

/** In the middle of the stack — both directions available. */
export const BothEnabled: Story = {
  render: () => (
    <Harness entries={["/", "/goals", "/tasks"]} currentIndex={1} />
  ),
}
