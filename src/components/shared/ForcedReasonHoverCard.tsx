import { format } from "date-fns"
import { Link } from "react-router"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import type { GoalFocusStatus } from "@/domain/derived/GoalFocus"
import { getBlockingGoalFocusStatuses } from "@/utils/goal-focus-status"
import { useLanguage } from "@/components/shared/language-provider"

// ── Goal forced reason ──────────────────────────────────────

interface GoalForcedHoverCardProps {
  goalId: string
  goalTitle: string
  statuses: GoalFocusStatus[]
  children: React.ReactNode
}

export function GoalForcedHoverCard({
  goalId,
  goalTitle,
  statuses,
  children,
}: GoalForcedHoverCardProps) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <span style={{ pointerEvents: "auto" }}>{children}</span>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <GoalReasonContent
          goalId={goalId}
          goalTitle={goalTitle}
          statuses={statuses}
        />
      </HoverCardContent>
    </HoverCard>
  )
}

function GoalReasonContent({
  goalId,
  goalTitle,
  statuses,
}: {
  goalId: string
  goalTitle: string
  statuses: GoalFocusStatus[]
}) {
  const blockingStatuses = getBlockingGoalFocusStatuses(statuses)
  const visibleStatuses =
    blockingStatuses.length > 0 ? blockingStatuses : statuses

  return (
    <div className="flex flex-col gap-3">
      {visibleStatuses.map((status, index) => (
        <GoalStatusMessage
          key={`${status.kind}-${index}`}
          goalId={goalId}
          goalTitle={goalTitle}
          status={status}
        />
      ))}
    </div>
  )
}

function GoalStatusMessage({
  goalId,
  goalTitle,
  status,
}: {
  goalId: string
  goalTitle: string
  status: GoalFocusStatus
}) {
  const { t } = useLanguage()
  const goalLink = (
    <Link
      to={`/goals/${goalId}`}
      className="font-medium text-primary underline-offset-2 hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {goalTitle}
    </Link>
  )

  switch (status.kind) {
    case "manualFocus":
      return (
        <p className="paragraph-small text-muted-foreground">
          {goalLink}{" "}
          {status.source === "trigger"
            ? t.forced.triggerFocus
            : t.forced.manualFocus}
        </p>
      )
    case "autoPlannedTask":
      return (
        <p className="paragraph-small text-muted-foreground">
          {goalLink} {t.forced.autoPlanned(status.runtimeKeys.length)}
        </p>
      )
    case "goalDuePolicy":
      return (
        <p className="paragraph-small text-muted-foreground">
          {goalLink}{" "}
          <span className="font-medium text-foreground underline">
            {format(status.dueAt, "PPP HH:mm")}
          </span>{" "}
          {t.forced.goalDuePolicy}
        </p>
      )
    case "taskDuePolicy":
      return (
        <p className="paragraph-small text-muted-foreground">
          {goalLink}{" "}
          <Link
            to={`/tasks/${status.taskId}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {status.taskTitle}
          </Link>{" "}
          <span className="font-medium text-foreground underline">
            {format(status.dueAt, "PPP HH:mm")}
          </span>{" "}
          {t.forced.taskDuePolicy}
        </p>
      )
    case "manualTodayTask":
      return (
        <p className="paragraph-small text-muted-foreground">
          {goalLink}{" "}
          <Link
            to={`/tasks/${status.taskId}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {status.taskTitle}
          </Link>{" "}
          {t.forced.manualTodayTask}
        </p>
      )
    case "repeatPolicyPoint":
      return (
        <p className="paragraph-small text-muted-foreground">
          {goalLink}{" "}
          <Link
            to={`/tasks/${status.taskId}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {status.taskTitle}
          </Link>{" "}
          {t.forced.repeatPolicy(status.plannedForDate)}
        </p>
      )
    case "taskTriggerPolicy":
      return (
        <p className="paragraph-small text-muted-foreground">
          {goalLink}{" "}
          <Link
            to={`/tasks/${status.taskId}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {status.taskTitle}
          </Link>{" "}
          {t.forced.taskTriggerPolicy(status.firedDate)}
        </p>
      )
  }
}

// ── Task forced reason ──────────────────────────────────────

interface TaskForcedHoverCardProps {
  taskId: string
  taskTitle: string
  dueAt: Date
  goalId?: string
  goalTitle?: string
  children: React.ReactNode
}

export function TaskForcedHoverCard({
  taskId,
  taskTitle,
  dueAt,
  goalId,
  goalTitle,
  children,
}: TaskForcedHoverCardProps) {
  const { t } = useLanguage()
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <span style={{ pointerEvents: "auto" }}>{children}</span>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <p className="paragraph-small text-muted-foreground">
          <Link
            to={`/tasks/${taskId}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {taskTitle}
          </Link>{" "}
          <span className="font-medium text-foreground underline">
            {format(dueAt, "PPP HH:mm")}
          </span>{" "}
          {t.forced.taskForced}
          {goalId && goalTitle && (
            <>
              {" "}
              {t.forced.linkedGoal}{" "}
              <Link
                to={`/goals/${goalId}`}
                className="font-medium text-primary underline-offset-2 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {goalTitle}
              </Link>
              .
            </>
          )}
        </p>
      </HoverCardContent>
    </HoverCard>
  )
}

// ── Repeat forced reason ────────────────────────────────────

interface RepeatForcedHoverCardProps {
  taskId: string
  taskTitle: string
  plannedForDate?: string
  children: React.ReactNode
}

export function RepeatForcedHoverCard({
  taskId,
  taskTitle,
  plannedForDate,
  children,
}: RepeatForcedHoverCardProps) {
  const { t } = useLanguage()
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <span style={{ pointerEvents: "auto" }}>{children}</span>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <p className="paragraph-small text-muted-foreground">
          <Link
            to={`/tasks/${taskId}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {taskTitle}
          </Link>{" "}
          {t.forced.repeatTaskImported(plannedForDate)}
        </p>
      </HoverCardContent>
    </HoverCard>
  )
}

// ── All tasks removed from today ────────────────────────────

/**
 * Explains a locked goal-focus toggle whose goal has every unfinished task
 * removed from today: focusing it could not surface any work.
 */
export function AllTasksDismissedHoverCard({
  children,
}: {
  children: React.ReactNode
}) {
  const { t } = useLanguage()
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <span style={{ pointerEvents: "auto" }}>{children}</span>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <p className="paragraph-small text-muted-foreground">
          {t.home.focusAllTasksDismissed}
        </p>
      </HoverCardContent>
    </HoverCard>
  )
}
