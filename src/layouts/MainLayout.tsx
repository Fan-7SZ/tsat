import { Outlet, useLoaderData, useLocation } from "react-router"
import type { GoalTaskHierarchySource } from "@/hooks/use-entities"
import { deleteGoal } from "@/commands/goal.commands"
import { deleteTask } from "@/commands/task.commands"
import { DetailDeleteContextMenu } from "@/components/contextMenus/DetailDeleteContextMenu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  useSidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarGroupContent,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Home,
  Flag,
  List,
  ListChecks,
  ClipboardCheck,
  ListTodo,
  ChevronDown,
  ChevronRight,
  Circle,
  Check,
  Repeat,
  BellElectric,
  Plus,
  SquareArrowOutUpRight,
  Settings,
  HelpCircle,
  Info,
  type LucideIcon,
} from "lucide-react"
import { Link } from "react-router"
import type React from "react"
import { useCallback, useEffect, useState } from "react"
import {
  useGoalTaskHierarchy,
  type GoalTaskHierarchyGroup,
} from "@/hooks/use-entities"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import {
  classifyTask,
  type TaskCompletionCategory,
} from "@/utils/task-classify"
import { RUNTIME_STATUS_ICON } from "@/utils/task-runtime-icon"
import { areGoalTasksAllDone } from "@/utils/goal-done"
import { useTaskAggregateRunStatus } from "@/hooks/use-day-runs"
import { useUiStore } from "@/store/ui-store"
import { CreateGoalGuidanceDialog } from "@/components/dialogs/CreateGoalGuidanceDialog"
import { CreateTaskDialog } from "@/components/dialogs/CreateTaskDialog"
import {
  SettingsDialog,
  type SettingsTab,
} from "@/components/dialogs/SettingsDialog"
import { useLanguage } from "@/components/shared/language-provider"
import { useTagMap } from "@/hooks/use-tags"
import type { GoalID } from "@/domain/value-objects/types"
import { cn } from "@/lib/utils"
import { RowMenuButton } from "@/components/shared/row-context-menu"
import { AboutDialog } from "@/components/dialogs/AboutDialog"
import { useNavigate } from "react-router"

type SidebarCollapseState = {
  openGoals: boolean
  openStandaloneTasks: boolean
  openGoalItems: Record<GoalID, boolean>
}

const SIDEBAR_COLLAPSE_STORAGE_KEY = "main-layout-sidebar-collapse-state"

const defaultSidebarCollapseState: SidebarCollapseState = {
  openGoals: true,
  openStandaloneTasks: true,
  openGoalItems: {},
}

// Utility to read boolean record from an object, used for openGoalItems in sidebar state
function readBooleanRecord(value: unknown): Record<string, boolean> {
  // Returning format example: { "goalId1": true, "goalId2": false }

  //Because null is object , and array is object, but record is require here.
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      // Filter out entries where the value is not a boolean
      // Add type predicate to satisfy the return type
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean"
    )
  )
}

function readSidebarCollapseState(): SidebarCollapseState {
  if (typeof window === "undefined") {
    return defaultSidebarCollapseState
  }

  try {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY)
    if (!stored) {
      return defaultSidebarCollapseState
    }

    const parsed = JSON.parse(stored) as Partial<SidebarCollapseState>

    // Validate and fill missing fields with defaults
    return {
      openGoals:
        typeof parsed.openGoals === "boolean"
          ? parsed.openGoals
          : defaultSidebarCollapseState.openGoals,
      openStandaloneTasks:
        typeof parsed.openStandaloneTasks === "boolean"
          ? parsed.openStandaloneTasks
          : defaultSidebarCollapseState.openStandaloneTasks,
      openGoalItems: readBooleanRecord(parsed.openGoalItems),
    }
  } catch {
    return defaultSidebarCollapseState
  }
}

// Utility to read detail id from pathname, e.g. "/goals/123" => "123"
function readDetailId(pathname: string, basePath: string): string | undefined {
  const prefix = `${basePath}/`
  if (!pathname.startsWith(prefix)) {
    return undefined
  }

  const id = pathname.slice(prefix.length)
  return id && !id.includes("/") ? id : undefined
}

function SidebarHeaderContent() {
  // Control sidebar trigger visibility based on sidebar state
  const { state } = useSidebar()
  if (state === "collapsed") {
    return (
      <div className="flex h-16 justify-center py-2">
        <SidebarTrigger size="icon-lg" />
      </div>
    )
  } else {
    return (
      <div className="flex h-16 items-start justify-end px-4 py-2">
        <SidebarTrigger size="icon-lg" />
      </div>
    )
  }
}
// Sidebar footer: a button opening a menu with Settings / Help / About.
function SidebarFooterMenu({
  onOpenSettings,
  onOpenAbout,
}: {
  onOpenSettings: (tab: SettingsTab) => void
  onOpenAbout?: () => void
}) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { setOpenMobile } = useSidebar()

  // In-app navigation (no new tab) so the docs don't spin up a second SPA
  // instance; the /doc index redirects to the default page.
  //
  // Close the mobile sidebar sheet first and navigate a tick later: navigating
  // synchronously unmounts MainLayout with the sheet + this dropdown (two modal
  // Radix layers) still open, and their stacked-layer teardown races and leaves
  // `pointer-events: none` on <body> — the docs page then ignores every tap
  // until a reload.
  const onSelectDocument = useCallback(() => {
    setOpenMobile(false)
    setTimeout(() => {
      navigate("/doc")
    }, 0)
  }, [navigate, setOpenMobile])

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {/* Non-modal: on mobile this menu opens inside the sidebar sheet, which
            already holds the body pointer-events lock. Stacking a second modal
            layer is what makes the teardown race (see onSelectDocument). */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton>
              <span className="paragraph-small-medium">{t.sidebar.more}</span>
              <SquareArrowOutUpRight className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-48">
            <DropdownMenuItem onSelect={() => onOpenSettings("general")}>
              <Settings />
              <span>{t.settings.title}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Placeholders — wiring is follow-up work */}
            <DropdownMenuItem onSelect={onSelectDocument}>
              <HelpCircle />
              <span>{t.sidebar.help}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpenAbout}>
              <Info />
              <span>{t.sidebar.about}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

// Wrapped in sidebar menu item
function NavLink({
  to,
  icon: Icon,
  label,
  isActive,
}: {
  to: string
  icon: React.ReactNode
  label: string
  isActive: boolean
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link to={to}>
          {Icon}
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

/**
 * The sidebar tree is navigation, not a work surface, so a task row encodes
 * only the two properties that are stable across the day: whether it is
 * finished (leading circle / filled tick, struck-through title) and its
 * scheduling kind, which — like a goal's trigger bell — sits as a trailing
 * hint rather than replacing the completion circle.
 */
const TASK_KIND_HINT_ICON: Partial<Record<TaskCompletionCategory, LucideIcon>> =
  {
    repeat: Repeat,
    trigger: BellElectric,
  }

/**
 * A finished plain task, done the way Microsoft To Do does it: the circle fills
 * solid with the tag colour and the tick is knocked out of it in the sidebar's
 * own background, rather than drawn on top. Lucide's `CircleCheck` cannot do
 * this — filling it would paint the tick in the same colour as the disc.
 */
/**
 * The muted wash of a goal's tag colour, shared by everything in the group that
 * plays a supporting role: the indent rail, the trailing runtime hint, and the
 * hover fill of the row's buttons. Keeping them on one value is what makes the
 * group read as a single object rather than a pile of tinted parts.
 */
function railTint(tagColor: string): string {
  return `color-mix(in srgb, ${tagColor} 45%, transparent)`
}

function CompletedTaskIcon({ color }: { color?: string }) {
  return (
    <span
      className="flex size-4 items-center justify-center rounded-full"
      style={{ backgroundColor: color ?? "currentColor" }}
    >
      {/* `size-2.5!`: the sidebar forces `size-4` on every descendant svg. */}
      <Check className="size-2.5! text-sidebar" strokeWidth={3.5} />
    </span>
  )
}

function SidebarTaskLinkContent({
  task,
  tagColor,
}: {
  task: TaskGroupEntity
  /** The owning goal's tag colour; standalone tasks have none. */
  tagColor?: string
}) {
  const { t } = useLanguage()
  const isCompleted = task.completedCount >= task.total
  const category = classifyTask(task)
  const KindHintIcon = TASK_KIND_HINT_ICON[category]
  const kindHintLabel =
    category === "repeat" ? t.taskDetail.repeat : t.createGoal.settingTrigger

  // Scoped to this task's runs so a row only re-renders when its own task's
  // runs change, not on every unrelated runtime write.
  const runtimeStatus = useTaskAggregateRunStatus(task.id)
  const RuntimeIcon = runtimeStatus ? RUNTIME_STATUS_ICON[runtimeStatus] : null

  return (
    <>
      {/* Wrapped so the icon is not a direct child svg: the sidebar's `[&>svg]`
          rule forces the accent colour and would out-specify the tag tint.
          A task on today's list swaps the completion circle for its runtime
          status icon — being scheduled today is the more current fact. */}
      <span className="flex shrink-0 items-center">
        {RuntimeIcon && runtimeStatus ? (
          <RuntimeIcon
            aria-label={t.status[runtimeStatus]}
            className="size-4"
            style={tagColor ? { color: tagColor } : undefined}
          />
        ) : isCompleted ? (
          <CompletedTaskIcon color={tagColor} />
        ) : (
          <Circle
            className="size-4"
            style={tagColor ? { color: tagColor } : undefined}
          />
        )}
      </span>
      <span
        className={cn(
          "paragraph-small-medium truncate",
          isCompleted && "text-muted-foreground line-through"
        )}
      >
        {task.title}
      </span>
      {KindHintIcon && (
        // Wrapped for the same `[&>svg]` reason as the leading icon.
        <span className="ml-auto flex shrink-0 items-center">
          <KindHintIcon
            aria-label={kindHintLabel}
            // Inline style beats the sidebar's `[&>svg]` accent-colour rule.
            style={tagColor ? { color: tagColor } : undefined}
            className="size-4 shrink-0 text-muted-foreground"
          />
        </span>
      )}
    </>
  )
}

function GoalTaskTreeSidebar({
  groups,
  openGoalItems,
  onGoalItemOpenChange,
  onGoalCreateTaskClick,
}: {
  groups: GoalTaskHierarchyGroup[]
  openGoalItems: Record<GoalID, boolean>
  onGoalItemOpenChange: (goalId: GoalID, open: boolean) => void
  onGoalCreateTaskClick: (goalId: GoalID) => void
}) {
  const location = useLocation()
  const tagMap = useTagMap()
  const activeGoalId = readDetailId(location.pathname, "/goals")
  const activeTaskId = readDetailId(location.pathname, "/tasks")

  if (groups.length === 0) return null

  return (
    <SidebarMenu>
      {groups.map((group) => (
        <GoalTaskTreeItem
          key={group.goal.id}
          group={group}
          tagColor={
            group.goal.tagId ? tagMap[group.goal.tagId]?.color : undefined
          }
          isActive={activeGoalId === group.goal.id}
          activeTaskId={activeTaskId}
          open={openGoalItems[group.goal.id] ?? true}
          onOpenChange={(open) => onGoalItemOpenChange(group.goal.id, open)}
          onCreateTaskClick={onGoalCreateTaskClick}
        />
      ))}
    </SidebarMenu>
  )
}
// Wrapped in sidebar menu item, with collapsible for tasks
function GoalTaskTreeItem({
  group,
  tagColor,
  isActive,
  activeTaskId,
  open,
  onOpenChange,
  onCreateTaskClick,
}: {
  group: GoalTaskHierarchyGroup
  /** CSS colour of the goal's tag; tints the goal icon and the subtree's rail. */
  tagColor?: string
  isActive: boolean
  activeTaskId: string | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateTaskClick: (goalId: GoalID) => void
}) {
  const { t } = useLanguage()
  const { isMobile } = useSidebar()
  const { goal, tasks } = group
  const hasTasks = tasks.length > 0
  const isDone = areGoalTasksAllDone(tasks)
  const hasTrigger = goal.trigger != null
  const GoalIcon = isDone ? ListChecks : List

  return (
    <SidebarMenuItem
      // Tag colour washed over the whole group (goal row + its task subtree).
      // color-mix takes the raw hex, so no rgba conversion is needed.
      className={cn(tagColor && "rounded-md")}
      style={
        tagColor
          ? {
              backgroundColor: `color-mix(in srgb, ${tagColor} 10%, transparent)`,
            }
          : undefined
      }
    >
      <Collapsible
        open={hasTasks && open}
        onOpenChange={(nextOpen) => {
          if (hasTasks) {
            onOpenChange(nextOpen)
          }
        }}
      >
        {/* The context menu wraps the whole row (not just the link): a
            right-click anywhere on it works, and the "⋮" button below reaches
            the trigger by plain bubbling. */}
        <DetailDeleteContextMenu
          detailPath={`/goals/${goal.id}`}
          deleteTitle={t.goalDetail.deleteGoalTitle}
          deleteDescription={t.goalDetail.deleteGoalDescription}
          onDelete={() => deleteGoal(goal.id, t.commands.goalDeleteFailed)}
        >
          <div className="relative flex min-w-0 items-center">
            <SidebarMenuButton
              asChild
              isActive={isActive}
              className="peer/menu-button h-8 min-w-0 flex-1 pr-14 pl-8"
            >
              <Link
                to={`/goals/${goal.id}`}
                className="flex min-w-0 items-center"
              >
                <span
                  className={cn(
                    "paragraph-small-medium truncate",
                    isDone && "text-muted-foreground line-through"
                  )}
                >
                  {goal.title}
                </span>
                {hasTrigger && (
                  <BellElectric
                    aria-label={t.createGoal.settingTrigger}
                    style={tagColor ? { color: tagColor } : undefined}
                    className="ml-auto size-4 shrink-0 text-muted-foreground"
                  />
                )}
              </Link>
            </SidebarMenuButton>

            {/* goal icon before title, relative positioned to avoid being covered by collapsible trigger */}
            {/* The icon will be hidden when collapsible trigger is visible (i.e. has tasks and not open), to avoid visual clutter. */}
            <div className="pointer-events-none absolute top-0 bottom-0 left-2 flex w-4 items-center justify-center group-data-[collapsible=icon]:hidden">
              {/* A goal reads as its task list: unchecked while any task is open,
                checked off once they are all done. */}
              <GoalIcon
                className="size-4 shrink-0 opacity-100 transition-opacity group-focus-within/menu-item:opacity-0 group-hover/menu-item:opacity-0"
                style={tagColor ? { color: tagColor } : undefined}
              />
            </div>

            {/* collapsible trigger for tasks, sharing position with goal icon */}
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                // Tag colour for the glyph; the hover fill stays the default.
                style={tagColor ? { color: tagColor } : undefined}
                className={cn(
                  "absolute top-1 left-1 z-10 size-6 opacity-0 transition-opacity group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 group-data-[collapsible=icon]:hidden",
                  // when hasTasks == false, add 'pointer-events-none' to make it unclickable
                  // and ensure it won't affect the hover/focus state of the parent menu item
                  !hasTasks && "pointer-events-none"
                )}
                onClick={(event) => {
                  // Prevent click event spreading to the menu item
                  // which would cause unwanted navigation when clicking the trigger button
                  event.stopPropagation()
                }}
              >
                <ChevronRight
                  className={cn(
                    "transition-transform",
                    hasTasks && open && "rotate-90"
                  )}
                />
              </Button>
            </CollapsibleTrigger>

            {/* Mirror of the collapse trigger on the right — same Button box,
              position (top-1) and reveal — so the two controls read as one
              layout. SidebarMenuAction sits at its own top-1.5, which left the
              plus 2px lower than the centred chevron. */}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t.createTask.title}
              style={tagColor ? { color: tagColor } : undefined}
              className="absolute top-1 right-1 z-10 opacity-0 transition-opacity group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 group-data-[collapsible=icon]:hidden"
              onClick={(event) => {
                event.stopPropagation()
                onCreateTaskClick(goal.id)
              }}
            >
              <Plus />
            </Button>

            <RowMenuButton
              size="icon-sm"
              className={cn(
                "absolute top-1 right-8 z-10 size-6 text-muted-foreground transition-opacity group-data-[collapsible=icon]:hidden",
                // Same reveal as the sibling controls on desktop; always shown
                // on touch, where hover never happens and the row's menu (its
                // only way to delete) would otherwise be unreachable.
                isMobile
                  ? "opacity-100"
                  : "opacity-0 group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100"
              )}
            />
          </div>
        </DetailDeleteContextMenu>

        {/* tasks list */}
        {hasTasks && (
          <CollapsibleContent>
            {/* The rail is drawn as a pseudo-element rather than the primitive's
                `border-l`: a border cannot have rounded caps, and insetting it
                top/bottom keeps it clear of the group's edges.

                It is only an indent guide — the group's tinted background is
                what actually delimits the subtree — so it takes a muted mix of
                the tag colour. At full strength it became the loudest thing in
                the sidebar, drowning out the task titles it exists to serve. */}
            <SidebarMenuSub
              className="relative border-l-0 before:absolute before:top-1 before:bottom-1 before:left-0 before:w-0.5 before:rounded-full before:bg-(--rail-color)"
              style={
                {
                  "--rail-color": tagColor
                    ? railTint(tagColor)
                    : "var(--sidebar-border)",
                } as React.CSSProperties
              }
            >
              {tasks.map((task) => (
                <SidebarMenuSubItem key={task.id}>
                  <DetailDeleteContextMenu
                    detailPath={`/tasks/${task.id}`}
                    deleteTitle={t.taskDetail.deleteTaskTitle}
                    deleteDescription={t.taskDetail.deleteTaskDescription}
                    onDelete={() =>
                      deleteTask(task.id, t.commands.taskDeleteFailed)
                    }
                  >
                    {/* Container so the "⋮" is a sibling of the link yet still
                        inside the menu trigger (a link may not nest a button). */}
                    <div className="group/sub-row relative flex min-w-0 items-center">
                      <SidebarMenuSubButton
                        asChild
                        isActive={activeTaskId === task.id}
                        className="min-w-0 flex-1 pr-7"
                      >
                        <Link to={`/tasks/${task.id}`}>
                          <SidebarTaskLinkContent
                            task={task}
                            tagColor={tagColor}
                          />
                        </Link>
                      </SidebarMenuSubButton>
                      <RowMenuButton
                        size="icon-sm"
                        className={cn(
                          "absolute right-0 z-10 size-6 text-muted-foreground transition-opacity",
                          isMobile
                            ? "opacity-100"
                            : "opacity-0 group-focus-within/sub-row:opacity-100 group-hover/sub-row:opacity-100"
                        )}
                      />
                    </div>
                  </DetailDeleteContextMenu>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        )}
      </Collapsible>
    </SidebarMenuItem>
  )
}

function StandaloneTasksSidebar({
  tasks,
}: {
  tasks: GoalTaskHierarchyGroup["tasks"]
}) {
  const location = useLocation()
  const { t } = useLanguage()
  const { isMobile } = useSidebar()
  const activeTaskId = readDetailId(location.pathname, "/tasks")

  if (tasks.length === 0) return null

  return (
    <SidebarMenu>
      {tasks.map((task) => (
        <SidebarMenuItem key={task.id}>
          <DetailDeleteContextMenu
            detailPath={`/tasks/${task.id}`}
            deleteTitle={t.taskDetail.deleteTaskTitle}
            deleteDescription={t.taskDetail.deleteTaskDescription}
            onDelete={() => deleteTask(task.id, t.commands.taskDeleteFailed)}
          >
            <div className="group/row relative flex min-w-0 items-center">
              <SidebarMenuButton
                asChild
                isActive={activeTaskId === task.id}
                className="h-8 min-w-0 flex-1 pr-7 pl-2"
              >
                <Link
                  to={`/tasks/${task.id}`}
                  className="flex min-w-0 items-center gap-2"
                >
                  <SidebarTaskLinkContent task={task} />
                </Link>
              </SidebarMenuButton>
              <RowMenuButton
                size="icon-sm"
                className={cn(
                  "absolute right-0 z-10 size-6 text-muted-foreground transition-opacity",
                  isMobile
                    ? "opacity-100"
                    : "opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100"
                )}
              />
            </div>
          </DetailDeleteContextMenu>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

// There are two groups in the sidebar, where one for showing goals and their tasks,
// another for showing standalone tasks. Each group is collapsible,
// and the goal group is also collapsible for each goal to show/hide its tasks.
// The collapse state is persisted in local storage, and can be controlled by user interaction with collapsible triggers.
function SidebarCollapsibleGroup({
  title,
  open,
  onOpenChange,
  children,
  action,
}: {
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  action?: React.ReactNode
}) {
  const { state } = useSidebar()
  if (state === "collapsed") return null

  return (
    // An open group sizes to its content and scrolls internally only once it
    // overflows; a closed one shrinks to just its label. `flex-initial` (grow 0)
    // is the key: the groups stack tight against each other with any spare space
    // left at the bottom, rather than each expanding and leaving a gap between
    // them. Shrink is allowed (so a tall group scrolls), and the `min-h` floor
    // keeps a very tall neighbour from crushing a small group down to nothing.
    <SidebarGroup
      className={cn("min-h-0", open ? "min-h-32 flex-initial" : "flex-none")}
    >
      <Collapsible
        open={open}
        onOpenChange={onOpenChange}
        className="flex min-h-0 flex-1 flex-col gap-1"
      >
        <SidebarGroupLabel className="group/label shrink-0">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="mr-1 -ml-1">
              {open ? <ChevronDown /> : <ChevronRight />}
            </Button>
          </CollapsibleTrigger>
          <span className="paragraph-mini text-sidebar-foreground">
            {title}
          </span>
          {action && (
            <div className="ml-auto opacity-0 transition-opacity group-hover/label:opacity-100">
              {action}
            </div>
          )}
        </SidebarGroupLabel>
        {/* CollapsibleContent stays the flex item so ScrollArea's root gets a
            definite height; the vertical-only ScrollArea keeps rows truncating
            instead of spilling a horizontal scrollbar. */}
        <CollapsibleContent className="flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1">
            <SidebarGroupContent>{children}</SidebarGroupContent>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  )
}

// MARK: MainLayout()
// Assemble point
export function MainLayout() {
  const location = useLocation()
  const { t } = useLanguage()

  const initialHierarchy = useLoaderData<GoalTaskHierarchySource>()
  const { goalGroups, standaloneTasks } =
    useGoalTaskHierarchy(initialHierarchy)
  const [collapseState, setCollapseState] = useState<SidebarCollapseState>(
    readSidebarCollapseState
  )

  // sub routes
  const isHomeActive = location.pathname === "/"
  const isMyGoalsActive = location.pathname === "/my-goals"
  const isMyTasksActive = location.pathname === "/tasks"
  const isAllTasksActive = location.pathname === "/all-tasks"

  // Persist sidebar collapse state to local storage whenever it changes
  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSE_STORAGE_KEY,
      JSON.stringify(collapseState)
    )
  }, [collapseState])

  // Handle section open/close state changes (goals section and standalone tasks section)
  const handleSectionOpenChange =
    (key: "openGoals" | "openStandaloneTasks") => (open: boolean) => {
      setCollapseState((prev) => ({
        ...prev,
        [key]: open,
      }))
    }

  // Handle goal item open/close state changes
  const handleGoalItemOpenChange = useCallback(
    (goalId: GoalID, open: boolean) => {
      setCollapseState((prev) => ({
        ...prev,
        openGoalItems: {
          ...prev.openGoalItems,
          [goalId]: open,
        },
      }))
    },
    []
  )

  // dialog control state
  const [isCreateGoalOpen, setIsCreateGoalOpen] = useState(false)
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)
  // A settings request filed before this layout mounted (the OpenRouter OAuth
  // callback navigates here right after filing one) seeds the dialog's initial
  // state — the subscription below only sees requests made while mounted. The
  // mount effect clears the consumed request from the store.
  const [initialSettingsRequest] = useState(
    () => useUiStore.getState().settingsRequest
  )
  const [isSettingsOpen, setIsSettingsOpen] = useState(
    initialSettingsRequest != null
  )
  const [settingsTab, setSettingsTab] = useState<SettingsTab>(
    initialSettingsRequest?.tab ?? "general"
  )
  const [isAboutOpen, setIsAboutOpen] = useState(false)

  const openSettings = useCallback((tab: SettingsTab) => {
    setSettingsTab(tab)
    setIsSettingsOpen(true)
  }, [])

  // Honor cross-cutting "open settings" requests from deep components (e.g. an
  // AI error's "open AI settings" link), which can't reach this local state.
  // Imperative subscription (not a reactive selector) so the setState runs in a
  // store callback, not synchronously in the effect body.
  useEffect(() => {
    // A request consumed via the initial dialog state above still sits in the
    // store; clear it so it isn't served twice.
    if (useUiStore.getState().settingsRequest) {
      useUiStore.getState().clearSettingsRequest()
    }
    return useUiStore.subscribe((state, prev) => {
      const req = state.settingsRequest
      if (req && req !== prev.settingsRequest) {
        openSettings(req.tab)
        useUiStore.getState().clearSettingsRequest()
      }
    })
  }, [openSettings])

  //state for create task dialog when opened by plus button on goal item
  const [createTaskForGoalId, setCreateTaskForGoalId] = useState<
    GoalID | undefined
  >()

  const handleCreateTaskOpenChange = useCallback((open: boolean) => {
    setIsCreateTaskOpen(open)
    if (!open) {
      setCreateTaskForGoalId(undefined)
    }
  }, [])

  const handleCreateStandaloneTaskClick = useCallback(() => {
    setCreateTaskForGoalId(undefined)
    setIsCreateTaskOpen(true)
  }, [])

  const handleGoalCreateTaskClick = useCallback((goalId: GoalID) => {
    setCreateTaskForGoalId(goalId)
    setIsCreateTaskOpen(true)
  }, [])

  return (
    <div className="flex h-screen w-screen flex-col">
      <CreateGoalGuidanceDialog
        open={isCreateGoalOpen}
        onOpenChange={setIsCreateGoalOpen}
      />
      <CreateTaskDialog
        open={isCreateTaskOpen}
        onOpenChange={handleCreateTaskOpenChange}
        fixedGoalId={createTaskForGoalId}
      />

      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        defaultTab={settingsTab}
      />

      <SidebarProvider className="flex flex-1">
        <Sidebar collapsible="icon">
          {/* The sidebar itself does not scroll (overflow-hidden); scrolling
              lives inside each group so the header + nav stay fixed. */}
          <SidebarContent className="overflow-hidden">
            <SidebarHeaderContent />

            {/* Main navigation */}
            <SidebarGroup className="shrink-0">
              <SidebarMenu>
                <NavLink
                  to="/"
                  icon={<Home />}
                  label={t.nav.home}
                  isActive={isHomeActive}
                />
                <NavLink
                  to="/my-goals"
                  icon={<Flag />}
                  label={t.nav.myGoals}
                  isActive={isMyGoalsActive}
                />
                <NavLink
                  to="/tasks"
                  icon={<ClipboardCheck />}
                  label={t.nav.myTasks}
                  isActive={isMyTasksActive}
                />
                <NavLink
                  to="/all-tasks"
                  icon={<ListTodo />}
                  label={t.nav.allTasks}
                  isActive={isAllTasksActive}
                />
              </SidebarMenu>
            </SidebarGroup>

            {/* Collapsible groups for goal/task sidebar, showing goal-task
                hierarchy and standalone tasks respectively. The route loader
                prefetches the hierarchy, so the very first paint already
                renders real data — no hold-back needed to avoid layout shift. */}
            {/* The groups share the height left below the nav; each scrolls
                within its share rather than the whole sidebar scrolling. */}
            <div className="flex min-h-0 flex-1 flex-col">
              <SidebarCollapsibleGroup
                title={t.nav.goals}
                open={collapseState.openGoals}
                onOpenChange={handleSectionOpenChange("openGoals")}
                action={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setIsCreateGoalOpen(true)}
                  >
                    <Plus />
                  </Button>
                }
              >
                <GoalTaskTreeSidebar
                  groups={goalGroups}
                  openGoalItems={collapseState.openGoalItems}
                  onGoalItemOpenChange={handleGoalItemOpenChange}
                  onGoalCreateTaskClick={handleGoalCreateTaskClick}
                />
              </SidebarCollapsibleGroup>

              <SidebarCollapsibleGroup
                title={t.common.standalone}
                open={collapseState.openStandaloneTasks}
                onOpenChange={handleSectionOpenChange("openStandaloneTasks")}
                action={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleCreateStandaloneTaskClick}
                  >
                    <Plus />
                  </Button>
                }
              >
                <StandaloneTasksSidebar tasks={standaloneTasks} />
              </SidebarCollapsibleGroup>
            </div>
          </SidebarContent>

          <SidebarFooter>
            <SidebarFooterMenu
              onOpenSettings={openSettings}
              onOpenAbout={() => setIsAboutOpen(true)}
            />
          </SidebarFooter>
        </Sidebar>

        {/* Main content */}
        <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          {/* Growing content box: fills the viewport when tall (so each page's
              h-full layout is unchanged), but never shrinks below a height
              floor on desktop — past that the inset scrolls vertically instead
              of squeezing cards. Mobile (<lg) keeps min-h-0 / its own scroll. */}
          <div className="flex min-h-0 flex-1 flex-col lg:min-h-180">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <AboutDialog shown={isAboutOpen} setShown={setIsAboutOpen} />
    </div>
  )
}
