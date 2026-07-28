import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router"
import { addDays } from "date-fns"

import { TaskQuickActions } from "@/components/task/TaskQuickActions"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import type { TaskID, TaskRuntimeID } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"

const RUNTIME_ID = "story-runtime-1" as TaskRuntimeID
const TASK_ID = "story-task-1" as TaskID

/**
 * The menu items only render inside a Radix context menu, so each story wraps
 * them in a trigger surface — right-click the dashed box to open the menu.
 * Store actions write to the real app store; in Storybook that is an isolated
 * in-browser store, so clicking items is safe.
 */
function MenuHarness(props: React.ComponentProps<typeof TaskQuickActions>) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="flex h-28 w-80 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground select-none">
          Right-click to open the quick actions
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <TaskQuickActions {...props} />
      </ContextMenuContent>
    </ContextMenu>
  )
}

const meta = {
  title: "Task/TaskQuickActions",
  component: TaskQuickActions,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  args: {
    runtimeId: RUNTIME_ID,
    taskId: TASK_ID,
    taskTitle: "Write weekly report",
    goalTitle: "Weekly goals",
    runtimeStatus: null,
  },
  render: (args) => <MenuHarness {...args} />,
  tags: ["autodocs"],
} satisfies Meta<typeof TaskQuickActions>

export default meta
type Story = StoryObj<typeof meta>

/** Not arranged today: only "add to today" plus navigation. */
export const NotArranged: Story = {}

/** Todo item: advance to in-progress / done, or exclude from today. */
export const Todo: Story = {
  args: { runtimeStatus: "todo" },
}

/** In-progress item: mark done or move back to todo. */
export const InProgress: Story = {
  args: { runtimeStatus: "inProgress" },
}

/** Done item: both retract options. */
export const Done: Story = {
  args: { runtimeStatus: "done" },
}

/** Done counter task with occurrences left: adds "run again". */
export const DoneWithRunAgain: Story = {
  args: { runtimeStatus: "done", canRunAgain: true },
}

/**
 * Due-forced item: exclusion is disabled because the due policy would pull it
 * straight back — hover the disabled item to see the reason card.
 */
export const DueForced: Story = {
  args: {
    runtimeStatus: "todo",
    forcedDueAt: addDays(new Date(), 1),
    goalId: "story-goal-1",
  },
}

/** Today's repeat occurrence: "skip" replaces "exclude from today". */
export const RepeatToday: Story = {
  args: {
    runtimeStatus: "todo",
    isRepeatTask: true,
    runtimeSource: "repeatPolicy",
    onSkipRepeat: () => {},
  },
}

/** Skipped repeat point: restore it, or open per-point custom completion. */
export const SkippedRepeat: Story = {
  args: {
    runtimeStatus: null,
    isRepeatTask: true,
    isSkippedRepeat: true,
    onRestoreSkipped: () => {},
    onCustomizeCompletion: () => {},
  },
}

/** Future repeat plan point: offers adding it to today ahead of schedule. */
export const FutureRepeatPlan: Story = {
  args: {
    runtimeStatus: null,
    isRepeatTask: true,
    plannedForDate: "2026-07-30" as LocalDateKey,
  },
}
