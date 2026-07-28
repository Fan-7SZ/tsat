import type { Meta, StoryObj } from "@storybook/react-vite"
import { DragDropProvider } from "@dnd-kit/react"

import { StepsItem } from "@/components/task/StepsItem"
const meta = {
  component: StepsItem,
  title: "Components/StepsItem",
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  // StepsItem uses useDraggable, which requires a DragDropProvider in context.
  decorators: [
    (Story) => (
      <DragDropProvider>
        <Story />
      </DragDropProvider>
    ),
  ],
} satisfies Meta<typeof StepsItem>

export default meta

type Story = StoryObj<typeof meta>

export const ReadOnly: Story = {
  args: {
    title: "Step 1",
    id: "1",
    index: 1,
  },
}

export const Editable: Story = {
  args: {
    title: "Double-click to edit, hover to remove",
    id: "2",
    index: 2,
    onTitleChange: () => {},
    onRemove: () => {},
  },
}
