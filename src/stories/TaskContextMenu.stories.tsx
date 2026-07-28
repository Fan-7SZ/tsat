import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router"
import { fireEvent, within } from "storybook/test"

import { TaskContextMenu } from "@/components/contextMenus/TaskContextMenu"
import type { TaskID, TaskRuntimeID } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"

const RUNTIME_ID = "runtime-story-1" as TaskRuntimeID
const TASK_ID = "task-story-1" as TaskID

function Harness(
  props: Partial<React.ComponentProps<typeof TaskContextMenu>> & {
    label?: string
  }
) {
  const { label = "Right-click this task row", ...menuProps } = props
  return (
    <div className="p-6">
      <TaskContextMenu
        runtimeId={RUNTIME_ID}
        taskId={TASK_ID}
        taskTitle="Write weekly review"
        goalId="goal-story-1"
        goalTitle="Stay organized"
        runtimeStatus={null}
        {...menuProps}
      >
        {/* Plain DOM child: the trigger's `asChild` props must land on a DOM
            element for right-click to reach the menu. */}
        <div
          data-testid="task-row"
          className="w-80 rounded-md border p-4 paragraph-small text-muted-foreground"
        >
          {label}
        </div>
      </TaskContextMenu>
    </div>
  )
}

const openMenu = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  fireEvent.contextMenu(await canvas.findByTestId("task-row"))
  const body = within(canvasElement.ownerDocument.body)
  await body.findAllByRole("menuitem")
}

const meta = {
  title: "ContextMenus/TaskContextMenu",
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 440 } },
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

/** Task not planned for today — offers "add to today". */
export const NotPlanned: Story = {
  render: () => <Harness label="Task not on today (right-click)" />,
  play: ({ canvasElement }) => openMenu(canvasElement),
}

/** Todo on today — start / mark done / exclude. */
export const TodoOnToday: Story = {
  render: () => <Harness runtimeStatus="todo" label="Todo task (right-click)" />,
  play: ({ canvasElement }) => openMenu(canvasElement),
}

/** In progress — mark done or move back to todo. */
export const InProgress: Story = {
  render: () => (
    <Harness runtimeStatus="inProgress" label="In-progress task (right-click)" />
  ),
  play: ({ canvasElement }) => openMenu(canvasElement),
}

/** Done counter task with occurrences left — offers "run again". */
export const DoneCanRunAgain: Story = {
  render: () => (
    <Harness runtimeStatus="done" canRunAgain label="Done task (right-click)" />
  ),
  play: ({ canvasElement }) => openMenu(canvasElement),
}

/** Repeat-imported run — "skip" replaces "exclude from today". */
export const RepeatImported: Story = {
  render: () => (
    <Harness
      runtimeStatus="todo"
      isRepeatTask
      runtimeSource="repeatPolicy"
      plannedForDate={"2026-07-26" as LocalDateKey}
      onSkipRepeat={() => {}}
      label="Repeat task (right-click)"
    />
  ),
  play: ({ canvasElement }) => openMenu(canvasElement),
}

/**
 * Due-forced run — "exclude from today" is disabled; a hover card explains
 * which due date pins it to today.
 */
export const ForcedByDue: Story = {
  render: () => (
    <Harness
      runtimeStatus="todo"
      forcedDueAt={new Date(2026, 6, 27, 18, 0)}
      label="Due-forced task (right-click)"
    />
  ),
  play: ({ canvasElement }) => openMenu(canvasElement),
}

/** Skipped repeat row — restore, or open the per-point completion dialog. */
export const SkippedRepeat: Story = {
  render: () => (
    <Harness
      isRepeatTask
      isSkippedRepeat
      onRestoreSkipped={() => {}}
      onCustomizeCompletion={() => {}}
      label="Skipped repeat task (right-click)"
    />
  ),
  play: ({ canvasElement }) => openMenu(canvasElement),
}
