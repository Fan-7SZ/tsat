import type { Meta, StoryObj } from "@storybook/react-vite"

import { StepsSkeletonList } from "@/components/task/StepsSkeletonList"

/**
 * Placeholder rows shown while AI step completion runs. Built from the same
 * <Item> primitives as the real step rows, so the list height matches and
 * nothing shifts when the generated steps resolve.
 */
const meta = {
  title: "Task/StepsSkeletonList",
  component: StepsSkeletonList,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="mx-auto w-96 max-w-full">
        <Story />
      </div>
    ),
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof StepsSkeletonList>

export default meta
type Story = StoryObj<typeof meta>

/** Default placeholder while the step count is still unknown. */
export const Default: Story = {}

/** The AI decided on a single step. */
export const SingleRow: Story = {
  args: { count: 1 },
}

/** Larger decided step count — widths repeat with variation. */
export const ManyRows: Story = {
  args: { count: 6 },
}
