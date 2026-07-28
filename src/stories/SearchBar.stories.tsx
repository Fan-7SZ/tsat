import type { Meta, StoryObj } from "@storybook/react-vite"

import { SearchBar } from "@/components/shared/SearchBar"

const meta = {
  title: "Shared/SearchBar",
  component: SearchBar,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof SearchBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="w-80 p-6">
      <SearchBar placeholder="Search tasks…" />
    </div>
  ),
}
