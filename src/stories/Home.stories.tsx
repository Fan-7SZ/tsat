import type { Meta, StoryObj } from "@storybook/react-vite"
import { useMemo, useState } from "react"
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"

import { Home } from "@/pages/Home"
import { fetchListPagesSnapshot } from "@/hooks/use-page-view-models"

function StoryHarness() {
  // The page reads its first frame from the route loader; stub it with the
  // same fetch the real loader uses (minus app bootstrap, which stories skip).
  const [router] = useState(() =>
    createMemoryRouter(
      [{ path: "/", element: <Home />, loader: fetchListPagesSnapshot }],
      { initialEntries: ["/"] }
    )
  )
  return useMemo(() => <RouterProvider router={router} />, [router])
}

const meta = {
  component: Home,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof Home>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <StoryHarness />,
}
