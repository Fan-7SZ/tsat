import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router"
import { fireEvent, within } from "storybook/test"

import { GoalContextMenu } from "@/components/contextMenus/GoalContextMenu"
import type { GoalID } from "@/domain/value-objects/types"

const GOAL_ID = "goal-ctx-story" as GoalID

function Harness(
  props: Partial<React.ComponentProps<typeof GoalContextMenu>> & {
    label?: string
  }
) {
  const { label = "Right-click this goal row", ...menuProps } = props
  return (
    <div className="p-6">
      <GoalContextMenu
        goalId={GOAL_ID}
        goalTitle="Ship the release"
        isFocused={false}
        isDone={false}
        {...menuProps}
      >
        <div
          data-testid="goal-row"
          className="w-80 rounded-md border p-4 paragraph-small text-muted-foreground"
        >
          {label}
        </div>
      </GoalContextMenu>
    </div>
  )
}

const openMenu = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  fireEvent.contextMenu(await canvas.findByTestId("goal-row"))
  const body = within(canvasElement.ownerDocument.body)
  await body.findAllByRole("menuitem")
}

const meta = {
  title: "ContextMenus/GoalContextMenu",
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 400 } },
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  tags: ["autodocs"],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** Active goal — focus, view details and delete (with confirm dialog). */
export const ActiveGoal: Story = {
  render: () => <Harness />,
  play: ({ canvasElement }) => openMenu(canvasElement),
}

/** Focused goal — the first action flips to "unfocus". */
export const FocusedGoal: Story = {
  render: () => <Harness isFocused label="Focused goal (right-click)" />,
  play: ({ canvasElement }) => openMenu(canvasElement),
}

/** Done goal — only navigation and delete remain. */
export const DoneGoal: Story = {
  render: () => <Harness isDone label="Done goal (right-click)" />,
  play: ({ canvasElement }) => openMenu(canvasElement),
}
