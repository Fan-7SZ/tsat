import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router"
import { fireEvent, within } from "storybook/test"

import { GoalQuickActions } from "@/components/goal/GoalQuickActions"
import type { GoalFocusStatus } from "@/domain/derived/GoalFocus"
import type { GoalID, TaskID } from "@/domain/value-objects/types"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

const GOAL_ID = "goal-quick-actions" as GoalID

const blockingStatuses: GoalFocusStatus[] = [
  {
    kind: "taskDuePolicy",
    isBlocking: true,
    taskId: "task-due-1" as TaskID,
    taskTitle: "Submit the report",
    dueAt: new Date(2026, 6, 28, 18, 0),
  },
]

/**
 * GoalQuickActions renders ContextMenuItems, so it must live inside an open
 * Radix context menu. Each story wraps it in a right-clickable row and the
 * play function opens the menu so the items really render.
 */
function Harness(props: Partial<React.ComponentProps<typeof GoalQuickActions>>) {
  return (
    <div className="p-6">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            data-testid="goal-row"
            className="w-80 rounded-md border p-4 paragraph-small text-muted-foreground"
          >
            Right-click this goal row
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <GoalQuickActions
            goalId={GOAL_ID}
            goalTitle="Ship the release"
            isFocused={false}
            isDone={false}
            onRequestDelete={() => {}}
            {...props}
          />
        </ContextMenuContent>
      </ContextMenu>
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
  title: "ContextMenus/GoalQuickActions",
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

/** Not focused, not done: focus action + view details + delete. */
export const NotFocused: Story = {
  render: () => <Harness />,
  play: ({ canvasElement }) => openMenu(canvasElement),
}

/** Focused: the first item flips to "unfocus". */
export const Focused: Story = {
  render: () => <Harness isFocused />,
  play: ({ canvasElement }) => openMenu(canvasElement),
}

/**
 * Focus forced by a blocking status (a task due) — "unfocus" is disabled and a
 * hover card explains why.
 */
export const ForcedFocus: Story = {
  render: () => (
    <Harness isFocused isForced focusStatuses={blockingStatuses} />
  ),
  play: ({ canvasElement }) => openMenu(canvasElement),
}

/** Done goal: focus actions disappear, only navigation + delete remain. */
export const DoneGoal: Story = {
  render: () => <Harness isDone />,
  play: ({ canvasElement }) => openMenu(canvasElement),
}
