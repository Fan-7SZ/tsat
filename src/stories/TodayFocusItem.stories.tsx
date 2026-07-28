import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { MemoryRouter } from "react-router"
import { TodayFocusItem } from "@/components/task/TodayFocusItem"

const baseArgs = {
  id: "focus-story-1",
  title: "Default Focus Item",
  progress: 50,
  isAdded: false,
}

const meta = {
  title: "Components/TodayFocusItem",
  component: TodayFocusItem,
  args: baseArgs,
  parameters: {
    layout: "padded",
    docs: { story: { inline: false, iframeHeight: 320 } },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof TodayFocusItem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    ...baseArgs,
  },
}

export const Added: Story = {
  args: {
    ...baseArgs,
    id: "focus-story-2",
    title: "Added Focus Item",
    progress: 75,
    isAdded: true,
  },
}

export const WithDueDate: Story = {
  args: {
    ...baseArgs,
    id: "focus-story-3",
    title: "Focus Item with Due Date",
    progress: 30,
    isAdded: false,
    due: "2024-12-31",
  },
}

export const MultipleFocusItems: Story = {
  args: baseArgs,
  render: () => (
    <div className="space-y-3">
      <TodayFocusItem
        id="focus-story-1"
        title="Focus Item 1"
        progress={20}
        isAdded={false}
      />
      <TodayFocusItem
        id="focus-story-2"
        title="Focus Item 2"
        progress={80}
        isAdded={true}
        due="2024-12-31"
      />
      <TodayFocusItem
        id="focus-story-3"
        title="Focus Item 3"
        progress={50}
        isAdded={false}
      />
    </div>
  ),
}

export const InteractiveToggle: Story = {
  args: {
    ...baseArgs,
    id: "focus-story-4",
    title: "Interactive Focus Item",
    progress: 60,
  },
  render: (args) => {
    const [added, setAdded] = useState(args.isAdded)

    return <TodayFocusItem {...args} isAdded={added} onAddedChange={setAdded} />
  },
}
