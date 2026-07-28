import type { Meta, StoryObj } from "@storybook/react-vite"

import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"

const meta = {
  title: "Shared/PageHeader",
  component: PageHeader,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof PageHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { children: null },
  render: () => (
    <PageHeader>
      <h2 className="heading-2">My Goals</h2>
      <Button size="sm" className="ml-auto">
        New Goal
      </Button>
    </PageHeader>
  ),
}
