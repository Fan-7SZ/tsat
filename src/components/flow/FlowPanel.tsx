import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react"

import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  Panel,
} from "@xyflow/react"
import dagre from "dagre"
import "@xyflow/react/dist/style.css"
import { Link } from "react-router"
import { CircleCheck, Repeat } from "lucide-react"
import {
  RUNTIME_STATUS_ICON,
  RUNTIME_STATUS_ICON_COLOR,
} from "@/utils/task-runtime-icon"
import { updateDependency } from "@/commands/dependency.commands"
import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { TaskRuntimeStatus } from "@/domain/entities/TaskRuntimeEntity"
import type { ActiveRepeatRule } from "@/domain/value-objects/repeatRule"
import { Button } from "@/components/ui/button"
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"
import { useTheme } from "@/components/shared/theme-provider"
import { useLanguage } from "@/components/shared/language-provider"
import { useTaskMap } from "@/hooks/use-entities"
import { useIsMobile } from "@/hooks/use-mobile"
import { useAppStore } from "@/store/app-store"
import { EMPTY_DAY_RUN_MAP, useDayRunMap } from "@/hooks/use-day-runs"
import { useUiStore } from "@/store/ui-store"
import { aggregateRuntimeStatus } from "@/utils/task-runtime"
import { cn } from "@/lib/utils"
import {
  DependencyAssistPopover,
  type DependencyAssistPhase,
  type DependencyErrorKind,
} from "@/components/flow/DependencyAssistPopover"
import { DependencyOptimizingOverlay } from "@/components/flow/DependencyOptimizingOverlay"
import { optimizeDependencies } from "@/services/ai/ai-scenarios"
import { extractAiError } from "@/services/ai/ai"

import { ExternalLink, Trash } from "lucide-react"

const START_ID = "start"
const END_ID = "end"
const NODE_WIDTH = 200
const NODE_HEIGHT = 44

// MARK: node data structure
type TaskNodeI18n = {
  steps: (n: number) => string
  progress: string
  estimated: string
  taskCompleted: string
  recurringTask: string
  runtimeTodo: string
  runtimeInProgress: string
  runtimeDone: string
}

type TaskNodeHoverInfo = {
  stepsCount?: number
  completedCount?: number
  totalCount?: number
  estimatedDuration?: number
  dueAt?: string
  repeat?: ActiveRepeatRule
  repeatStartsAt?: string
  repeatEndsAt?: string
  isRepeating: boolean
  dueLabel?: string
  dayNames?: string[]
}
/**
 * @property label - The display label of the task node, typically the task title.
 * @property taskId - The unique identifier of the task associated with this node.
 * @property navigable - A boolean indicating whether the node is clickable to navigate to task detail page.
 * @property highlighted - A boolean indicating whether the node is in a highlighted state, which can be used to visually distinguish it (e.g., when it's a draft node).
 * @property isFullyCompleted - A boolean indicating whether the task is fully completed, which can be used to show a completed status icon.
 * @property todayRuntimeStatus - The runtime status of the task for today (e.g., "todo", "inProgress", "done"), which can be used to show today's status icon.
 * @property hoverInfo - An object containing additional information about the task to be displayed in a hover card, such as steps count, progress, due date, repeat rule, etc.
 * @property tFlowPanel - An optional object containing i18n strings for the flow panel, used to localize the hover card content and tooltips.
 */
type TaskNodeData = {
  label: string
  taskId: string
  navigable?: boolean
  highlighted?: boolean
  isFullyCompleted?: boolean
  todayRuntimeStatus?: TaskRuntimeStatus
  hoverInfo?: TaskNodeHoverInfo
  tFlowPanel?: TaskNodeI18n
  /** On touch/mobile the node never navigates on tap (tap opens the node
   *  menu instead); the label renders as a non-navigating span. */
  isMobile?: boolean
}

// MARK: utils
const DAY_NAMES_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
/**
 * Generates descriptive text for a repeat rule, such as "Daily", "Every 2 days", "Weekly on Mon, Wed, Fri", etc., based on the provided repeat rule and optional day names for localization.
 */
function describeRepeat(
  rule: ActiveRepeatRule,
  dayNames: string[] = DAY_NAMES_EN
): string {
  if (rule.mode === "daily") {
    return rule.interval === 1 ? "Daily" : `Every ${rule.interval} days`
  }
  const days = rule.daysOfWeek
    .slice()
    .sort((a, b) => a - b)
    .map((d) => dayNames[d] ?? String(d))
    .join(", ")
  const prefix = rule.interval === 1 ? "Weekly" : `Every ${rule.interval} weeks`
  return days ? `${prefix} on ${days}` : prefix
}
/**
 * Formats an ISO date string into a human-readable date and time string. Such as "Sep 8, 2023, 02:30 PM". If the input is not a valid date, it returns the original string.
 * @param iso - The ISO date string to format.
 * @returns A formatted date and time string, or the original string if invalid.
 */
function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Formats an ISO date string into a human-readable date string without time. Such as "Sep 8, 2023". If the input is not a valid date, it returns the original string.
 * @param iso - The ISO date string to format.
 * @returns A formatted date string, or the original string if invalid.
 */
function formatDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
// MARK: React components

// Content for displaying some info about this task when hovering on the node.
// Shows label, steps count, progress, due date, repeat rule, etc.
function HoverCardBody({
  label,
  hoverInfo,
  tFlowPanel,
}: {
  label: string
  hoverInfo: TaskNodeHoverInfo
  tFlowPanel?: TaskNodeI18n
}) {
  const {
    stepsCount,
    completedCount,
    totalCount,
    estimatedDuration,
    dueAt,
    repeat,
    repeatStartsAt,
    repeatEndsAt,
    isRepeating,
    dueLabel,
    dayNames,
  } = hoverInfo
  return (
    <HoverCardContent side="bottom" className="w-56 space-y-1.5 p-3 paragraph-mini">
      <p className="truncate paragraph-small-medium">{label}</p>
      {stepsCount != null && stepsCount > 0 && (
        <p className="text-muted-foreground">
          {tFlowPanel?.steps(stepsCount) ?? `${stepsCount} steps`}
        </p>
      )}
      {totalCount != null && completedCount != null && (
        <p className="text-muted-foreground">
          {tFlowPanel?.progress ?? "Progress:"} {completedCount}/{totalCount}
        </p>
      )}
      {estimatedDuration != null && (
        <p className="text-muted-foreground">
          {tFlowPanel?.estimated ?? "Estimated:"} {estimatedDuration}m
        </p>
      )}
      {isRepeating && repeat ? (
        <>
          <p className="text-muted-foreground">
            {describeRepeat(repeat, dayNames)}
          </p>
          {repeatStartsAt && repeatEndsAt && (
            <p className="text-muted-foreground">
              {formatDay(repeatStartsAt)} – {formatDay(repeatEndsAt)}
            </p>
          )}
        </>
      ) : (
        dueAt && (
          <p className="text-muted-foreground">
            {dueLabel ?? "Due:"} {formatDate(dueAt)}
          </p>
        )
      )}
    </HoverCardContent>
  )
}
// Custom node for displaying a task in the flow
// Shows task label, and some icons for status (fully completed, recurring, today's runtime status). Supports clicking to navigate to task detail page and hovering to show more info.
function TaskNode({ data }: NodeProps<Node<TaskNodeData>>) {
  const {
    label,
    taskId,
    navigable,
    highlighted,
    isFullyCompleted,
    todayRuntimeStatus,
    hoverInfo,
    tFlowPanel,
    isMobile,
  } = data

  const isRepeating = hoverInfo?.isRepeating

  const runtimeStatusIcon = todayRuntimeStatus
    ? {
        Icon: RUNTIME_STATUS_ICON[todayRuntimeStatus],
        className: cn(
          "h-4 w-4",
          RUNTIME_STATUS_ICON_COLOR[todayRuntimeStatus]
        ),
        tooltip: {
          todo: tFlowPanel?.runtimeTodo ?? "Today's todo",
          inProgress: tFlowPanel?.runtimeInProgress ?? "Today's in progress",
          done: tFlowPanel?.runtimeDone ?? "Today's done",
        }[todayRuntimeStatus],
      }
    : null

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-md border px-3 shadow-sm",
        highlighted
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background"
      )}
      // import width and height constants by setting the style
      style={{ width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground"
      />

      {/* Status icons – top-right corner */}
      {navigable && (isFullyCompleted || isRepeating || runtimeStatusIcon) && (
        <TooltipProvider>
          <div className="nodrag nopan absolute -top-2 -right-2 flex gap-0.5">
            {runtimeStatusIcon && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <runtimeStatusIcon.Icon
                    className={runtimeStatusIcon.className}
                  />
                </TooltipTrigger>
                <TooltipContent side="top">
                  {runtimeStatusIcon.tooltip}
                </TooltipContent>
              </Tooltip>
            )}
            {isFullyCompleted && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <CircleCheck className="h-4 w-4 fill-green-500 text-background" />
                </TooltipTrigger>
                <TooltipContent side="top">
                  {tFlowPanel?.taskCompleted ?? "Task fully completed"}
                </TooltipContent>
              </Tooltip>
            )}
            {isRepeating && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Repeat className="h-4 w-4 text-primary" />
                </TooltipTrigger>
                <TooltipContent side="top">
                  {tFlowPanel?.recurringTask ?? "Recurring task"}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      )}

      {/* Label rendering */}
      {navigable && !isMobile && hoverInfo != null ? (
        /* GoalDetail: clickable Link + HoverCard (desktop only) */
        <HoverCard>
          <HoverCardTrigger asChild>
            <Link
              to={`/tasks/${taskId}`}
              className="nodrag nopan block truncate paragraph-small hover:underline"
            >
              {label}
            </Link>
          </HoverCardTrigger>
          <HoverCardBody
            label={label}
            hoverInfo={hoverInfo!}
            tFlowPanel={tFlowPanel}
          />
        </HoverCard>
      ) : hoverInfo != null ? (
        /* Draft: HoverCard only, no navigation */
        <HoverCard>
          <HoverCardTrigger asChild>
            <span className="nodrag nopan block cursor-default truncate paragraph-small">
              {label}
            </span>
          </HoverCardTrigger>
          <HoverCardBody
            label={label}
            hoverInfo={hoverInfo!}
            tFlowPanel={tFlowPanel}
          />
        </HoverCard>
      ) : (
        /* No task data (draft new-task node or fallback) */
        <span className="block truncate paragraph-small">{label}</span>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-muted-foreground"
      />
    </div>
  )
}
// MARK: algorithms for layout and cycle detection
const nodeTypes = { task: TaskNode }
const START_END_GAP = 120

type LayoutEdge = {
  source: string
  target: string
}
/**
 * Check whether two sides of the given edge are task nodes (i.e., not start or end nodes).
 * @param edge - The edge to check.
 * @returns A boolean indicating whether both sides of the edge are task nodes.
 */
function isBusinessEdge(edge: Edge | LayoutEdge): boolean {
  return (
    edge.source !== START_ID &&
    edge.source !== END_ID &&
    edge.target !== START_ID &&
    edge.target !== END_ID
  )
}
/**
 * Check whether the given node ID corresponds to a task node (i.e., not a start or end node).
 * @param nodeId - The ID of the node to check.
 * @returns A boolean indicating whether the node ID corresponds to a task node.
 */
function isBusinessNodeId(nodeId: string): boolean {
  return nodeId !== START_ID && nodeId !== END_ID
}
/**
 * Utilizing the dagre library to compute the layout of the task nodes based on their dependencies (edges). It returns the positions for each node and the vertical bounds of the layout. Only business edges (between task nodes) are considered for layout calculation, while edges connected to start/end nodes are ignored for layout purposes.
 * @param nodeCount - The number of task nodes.
 * @param layoutEdges - The edges representing dependencies between task nodes.
 * @returns An object containing the positions of each node, the center X coordinate, and the minimum and maximum Y coordinates.
 */
function getBusinessNodeLayout(nodeCount: number, layoutEdges: LayoutEdge[]) {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({
    rankdir: "TB",
    nodesep: 72,
    ranksep: 90,
    marginx: 16,
    marginy: 16,
  })

  for (let index = 0; index < nodeCount; index += 1) {
    graph.setNode(String(index), { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  layoutEdges.forEach((edge) => {
    if (!isBusinessEdge(edge)) return
    graph.setEdge(edge.source, edge.target)
  })

  dagre.layout(graph)

  const positions = new Map<string, { x: number; y: number }>()
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (let index = 0; index < nodeCount; index += 1) {
    const id = String(index)
    const node = graph.node(id)
    const x = node ? node.x - NODE_WIDTH / 2 : 0
    const y = node ? node.y - NODE_HEIGHT / 2 : 100 * (index + 1)

    positions.set(id, { x, y })
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
    minX = 0
    maxX = 0
    minY = 0
    maxY = 0
  }

  return {
    positions,
    centerX: (minX + maxX) / 2,
    minY,
    maxY,
  }
}
/**
 * Build a string of current flattened edges
 * @param edges - The array of edges to process.
 * @returns A string representing the flattened edges, sorted and joined by "|".
 */
function businessEdgeSignature(edges: Edge[]): string {
  return edges
    .filter(
      (edge) =>
        edge.source !== START_ID &&
        edge.source !== END_ID &&
        edge.target !== START_ID &&
        edge.target !== END_ID
    )
    .map((edge) => `${edge.source}->${edge.target}`)
    .sort()
    .join("|")
}

/**
 * Check whether the given set of business edges contains a cycle.
 * @param nodeCount - The number of task nodes.
 * @param businessEdges - The array of business edges to check.
 * @returns A boolean indicating whether a cycle exists in the business edges.
 */
function hasCycleByEdges(nodeCount: number, businessEdges: Edge[]): boolean {
  const indegree = new Array<number>(nodeCount).fill(0)
  const adjacency = new Map<number, Set<number>>()

  for (const edge of businessEdges) {
    const source = Number.parseInt(edge.source, 10)
    const target = Number.parseInt(edge.target, 10)
    if (
      Number.isNaN(source) ||
      Number.isNaN(target) ||
      source < 0 ||
      target < 0 ||
      source >= nodeCount ||
      target >= nodeCount
    ) {
      continue
    }
    const nextSet = adjacency.get(source) ?? new Set<number>()
    if (nextSet.has(target)) continue
    nextSet.add(target)
    adjacency.set(source, nextSet)
    indegree[target] += 1
  }

  const queue: number[] = []
  for (let i = 0; i < nodeCount; i += 1) {
    if (indegree[i] === 0) queue.push(i)
  }

  let visited = 0
  while (queue.length > 0) {
    const node = queue.shift()!
    visited += 1
    const neighbors = adjacency.get(node)
    if (!neighbors) continue
    for (const next of neighbors) {
      indegree[next] -= 1
      if (indegree[next] === 0) queue.push(next)
    }
  }

  return visited !== nodeCount
}

function collectDownstreamEdgeIds(
  startNodeId: string,
  edges: Edge[]
): Set<string> {
  const edgeIds = new Set<string>()
  const visitedNodes = new Set<string>()
  const stack = [startNodeId]

  while (stack.length > 0) {
    const nodeId = stack.pop()!
    if (visitedNodes.has(nodeId)) continue
    visitedNodes.add(nodeId)

    const outgoingEdges = edges.filter((edge) => edge.source === nodeId)
    for (const edge of outgoingEdges) {
      edgeIds.add(edge.id)
      if (!visitedNodes.has(edge.target)) {
        stack.push(edge.target)
      }
    }
  }

  return edgeIds
}

function buildTreeFromBusinessEdges(
  baseTree: DependencyEntity["tree"],
  edges: Edge[]
): DependencyEntity["tree"] {
  const businessEdges = edges.filter(isBusinessEdge)
  const nodeCount = baseTree.length
  const nextChildren = new Map<number, Set<number>>()
  const nextParents = new Map<number, Set<number>>()

  for (const edge of businessEdges) {
    const source = Number.parseInt(edge.source, 10)
    const target = Number.parseInt(edge.target, 10)
    if (
      Number.isNaN(source) ||
      Number.isNaN(target) ||
      source < 0 ||
      target < 0 ||
      source >= nodeCount ||
      target >= nodeCount
    ) {
      continue
    }

    const childrenSet = nextChildren.get(source) ?? new Set<number>()
    childrenSet.add(target)
    nextChildren.set(source, childrenSet)

    const parentsSet = nextParents.get(target) ?? new Set<number>()
    parentsSet.add(source)
    nextParents.set(target, parentsSet)
  }

  return baseTree.map((node, index) => {
    const parentSet = nextParents.get(index)
    const childrenSet = nextChildren.get(index)

    return {
      ...node,
      parent: parentSet && parentSet.size > 0 ? [...parentSet] : null,
      children: childrenSet && childrenSet.size > 0 ? [...childrenSet] : null,
    }
  })
}
/**
 * Convert an AI optimize result ({from, to} task-id pairs, "from depends on to")
 * into ReactFlow edges keyed by the tree's node indices, dropping unknown ids,
 * self-loops, and any edge that would introduce a cycle. Rebuilds the dashed
 * start/end fallbacks so unconnected nodes stay anchored.
 */
function buildEdgesFromOptimizeResult(
  tree: DependencyEntity["tree"],
  deps: Array<{ from: string; to: string }>
): Edge[] {
  const idToIndex = new Map<string, number>()
  tree.forEach((node, index) => idToIndex.set(String(node.data), index))

  const business: Edge[] = []
  const seen = new Set<string>()
  for (const dep of deps) {
    const fromIdx = idToIndex.get(dep.from)
    const toIdx = idToIndex.get(dep.to)
    if (fromIdx == null || toIdx == null || fromIdx === toIdx) continue
    // "from depends on to" → parent is `to`, child is `from`.
    const id = `${toIdx}-${fromIdx}`
    if (seen.has(id)) continue
    const candidate: Edge = {
      id,
      source: String(toIdx),
      target: String(fromIdx),
    }
    if (hasCycleByEdges(tree.length, [...business, candidate])) continue
    seen.add(id)
    business.push(candidate)
  }

  const hasParent = new Set(business.map((e) => e.target))
  const hasChild = new Set(business.map((e) => e.source))
  const fallback: Edge[] = []
  for (let i = 0; i < tree.length; i += 1) {
    const id = String(i)
    if (!hasParent.has(id)) {
      fallback.push({
        id: `start-${i}`,
        source: START_ID,
        target: id,
        selectable: false,
        deletable: false,
        style: { strokeDasharray: "4 2" },
      })
    }
    if (!hasChild.has(id)) {
      fallback.push({
        id: `${i}-end`,
        source: id,
        target: END_ID,
        selectable: false,
        deletable: false,
        style: { strokeDasharray: "4 2" },
      })
    }
  }
  return [...business, ...fallback]
}

function aiErrorKind(err: unknown): DependencyErrorKind {
  const { code } = extractAiError(err)
  return code === "timeout" ||
    code === "serverError" ||
    code === "badGateway" ||
    code === "serviceUnavailable"
    ? "network"
    : "api"
}

//MARK: FlowPanelCore
type FlowPanelCoreProps = {
  dependency: DependencyEntity
  className?: string
  navigable?: boolean
  draftNodeData?: string
  showSaveButton?: boolean
  /** Show the AI dependency-optimize button in the toolbar. */
  showAiOptimize?: boolean
  /** Goal title, passed to the AI as context. */
  goalTitle?: string
  onSaveTree?: (tree: DependencyEntity["tree"]) => void
  onTreeChange?: (tree: DependencyEntity["tree"]) => void
  canEditBusinessEdge?: (source: string, target: string) => boolean
  onNodeDetail?: (taskId: string) => void
  onNodeDelete?: (taskId: string) => void
  onNodeClick?: (nodeData: string) => void
}

type FlowPanelCanvasProps = FlowPanelCoreProps & {
  flowColorMode: "light" | "dark"
  initNodes: Node[]
  initEdges: Edge[]
}

function serializeFlowPanelState(nodes: Node[], edges: Edge[]) {
  return JSON.stringify([nodes, edges], (_key, value) =>
    typeof value === "function" ? "__fn__" : value
  )
}

function FlowPanelCore({
  dependency,
  className,
  navigable = false,
  draftNodeData,
  showSaveButton = false,
  showAiOptimize = false,
  goalTitle,
  onSaveTree,
  onTreeChange,
  canEditBusinessEdge,
  onNodeDetail,
  onNodeDelete,
  onNodeClick: onNodeClickProp,
}: FlowPanelCoreProps) {
  const { theme } = useTheme()
  const { t } = useLanguage()
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light"
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  })

  useEffect(() => {
    if (theme !== "system") return

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const updateTheme = () => {
      setSystemTheme(mediaQuery.matches ? "dark" : "light")
    }

    updateTheme()
    mediaQuery.addEventListener("change", updateTheme)

    return () => {
      mediaQuery.removeEventListener("change", updateTheme)
    }
  }, [theme])

  const flowColorMode = theme === "system" ? systemTheme : theme

  const taskMap = useTaskMap()
  const taskRuntime = useDayRunMap() ?? EMPTY_DAY_RUN_MAP
  const isMobile = useIsMobile()

  const baseBusinessEdges = useMemo<LayoutEdge[]>(
    () =>
      dependency.tree.flatMap((item, index) => {
        if (!item.children) return []
        return item.children.map((childIndex) => ({
          source: String(index),
          target: String(childIndex),
        }))
      }),
    [dependency.tree]
  )

  const initNodes = useMemo<Node[]>(() => {
    const layout = getBusinessNodeLayout(
      dependency.tree.length,
      baseBusinessEdges
    )

    return [
      {
        id: START_ID,
        type: "input",
        position: { x: layout.centerX, y: layout.minY - START_END_GAP },
        data: { label: "Start" },
        selectable: false,
        deletable: false,
        draggable: false,
      },
      ...dependency.tree.map((item, index) => {
        const task = taskMap[item.data]
        // One badge per node, even when the task holds several runs today.
        const runtimeStatus = task
          ? aggregateRuntimeStatus(taskRuntime, item.data)
          : undefined
        const isDraftNode = draftNodeData != null && item.data === draftNodeData
        const hoverInfo: TaskNodeHoverInfo | undefined = task
          ? {
              stepsCount: task.steps?.length,
              completedCount: task.completedCount,
              totalCount: task.total,
              estimatedDuration: task.estimatedDuration,
              dueAt: task.dueAt ? task.dueAt.toISOString() : undefined,
              repeat: task.repeat?.rule,
              repeatStartsAt: task.repeat?.startsAt
                ? task.repeat.startsAt.toISOString()
                : undefined,
              repeatEndsAt: task.repeat?.endsAt
                ? task.repeat.endsAt.toISOString()
                : undefined,
              isRepeating: task.repeat != null,
              dueLabel: t.common.due,
              dayNames: t.weekdays,
            }
          : undefined
        const nodeData: TaskNodeData = {
          label: item.title,
          taskId: item.data,
          navigable,
          highlighted: isDraftNode,
          isFullyCompleted:
            task != null && task.total > 0 && task.completedCount >= task.total,
          todayRuntimeStatus: runtimeStatus,
          hoverInfo,
          tFlowPanel: t.flowPanel,
          isMobile,
        }
        return {
          id: String(index),
          type: "task" as const,
          position: layout.positions.get(String(index)) ?? {
            x: 0,
            y: 100 * (index + 1),
          },
          data: nodeData,
        }
      }),
      {
        id: END_ID,
        type: "output",
        position: { x: layout.centerX, y: layout.maxY + START_END_GAP },
        data: { label: "End" },
        selectable: false,
        deletable: false,
        draggable: false,
      },
    ]
  }, [
    dependency.tree,
    baseBusinessEdges,
    navigable,
    draftNodeData,
    taskMap,
    taskRuntime,
    t,
    isMobile,
  ])

  const initEdges = useMemo<Edge[]>(() => {
    const edgeSet = new Set<string>()
    const businessEdges: Edge[] = dependency.tree.flatMap((item, index) => {
      if (!item.children) return []
      return item.children.map((childIndex) => ({
        id: `${index}-${childIndex}`,
        source: String(index),
        target: String(childIndex),
      }))
    })

    const dedupedBusiness = businessEdges.filter((edge) => {
      if (edgeSet.has(edge.id)) return false
      edgeSet.add(edge.id)
      return true
    })

    const startFallback: Edge[] = dependency.tree
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.parent || item.parent.length === 0)
      .map(({ index }) => ({
        id: `start-${index}`,
        source: START_ID,
        target: String(index),
        selectable: false,
        deletable: false,
        style: { strokeDasharray: "4 2" },
      }))

    const endFallback: Edge[] = dependency.tree
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.children || item.children.length === 0)
      .map(({ index }) => ({
        id: `${index}-end`,
        source: String(index),
        target: END_ID,
        selectable: false,
        deletable: false,
        style: { strokeDasharray: "4 2" },
      }))

    return [...dedupedBusiness, ...startFallback, ...endFallback]
  }, [dependency.tree])

  const flowStateKey = useMemo(
    () => serializeFlowPanelState(initNodes, initEdges),
    [initEdges, initNodes]
  )

  return (
    <FlowPanelCanvas
      key={flowStateKey}
      dependency={dependency}
      className={className}
      flowColorMode={flowColorMode}
      initNodes={initNodes}
      initEdges={initEdges}
      showSaveButton={showSaveButton}
      showAiOptimize={showAiOptimize}
      goalTitle={goalTitle}
      onSaveTree={onSaveTree}
      onTreeChange={onTreeChange}
      canEditBusinessEdge={canEditBusinessEdge}
      onNodeDetail={onNodeDetail}
      onNodeDelete={onNodeDelete}
      onNodeClick={onNodeClickProp}
    />
  )
}
//MARK: FlowPanelCanvas
function FlowPanelCanvas({
  dependency,
  className,
  flowColorMode,
  initNodes,
  initEdges,
  showSaveButton = false,
  showAiOptimize = false,
  goalTitle,
  onSaveTree,
  onTreeChange,
  canEditBusinessEdge,
  onNodeDetail,
  onNodeDelete,
  onNodeClick: onNodeClickProp,
}: FlowPanelCanvasProps) {
  const { t, language } = useLanguage()
  const isMobile = useIsMobile()
  const aiSettings = useAppStore((s) => s.aiSettings)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [nodes, setNodes] = useState<Node[]>(initNodes)
  const [edges, setEdges] = useState<Edge[]>(initEdges)

  // ── AI dependency optimize ──
  const [aiOpen, setAiOpen] = useState(false)
  const [aiDescription, setAiDescription] = useState("")
  const [aiPhase, setAiPhase] = useState<DependencyAssistPhase>("idle")
  const [aiError, setAiError] = useState<DependencyErrorKind | null>(null)
  // Node context menu anchor. Opened by right-click (desktop) or tap (mobile).
  const [nodeMenu, setNodeMenu] = useState<{
    x: number
    y: number
    taskId: string
  } | null>(null)

  const editMode = useMemo(
    () => businessEdgeSignature(edges) !== businessEdgeSignature(initEdges),
    [edges, initEdges]
  )

  const nextTree = useMemo(
    () => buildTreeFromBusinessEdges(dependency.tree, edges),
    [dependency.tree, edges]
  )

  const emittedSignatureRef = useRef<string | null>(null)

  useEffect(() => {
    if (!onTreeChange) return
    const currentSignature = businessEdgeSignature(edges)

    if (emittedSignatureRef.current === null) {
      emittedSignatureRef.current = currentSignature
      return
    }

    if (emittedSignatureRef.current === currentSignature) {
      return
    }

    emittedSignatureRef.current = currentSignature
    onTreeChange(nextTree)
  }, [edges, nextTree, onTreeChange])

  const highlightedEdgeIds = useMemo(() => {
    if (!selectedNodeId || !isBusinessNodeId(selectedNodeId)) {
      return new Set<string>()
    }

    return collectDownstreamEdgeIds(selectedNodeId, edges)
  }, [edges, selectedNodeId])

  const displayEdges = useMemo(
    () =>
      edges.map((edge) => {
        if (!highlightedEdgeIds.has(edge.id)) {
          return { ...edge, animated: false }
        }

        return {
          ...edge,
          animated: true,
          style: {
            ...edge.style,
            stroke: "hsl(221.2 83.2% 53.3%)",
            strokeWidth: 2,
          },
        }
      }),
    [edges, highlightedEdgeIds]
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  )

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return
      if (
        !isBusinessNodeId(params.source) ||
        !isBusinessNodeId(params.target)
      ) {
        return
      }
      if (
        canEditBusinessEdge &&
        !canEditBusinessEdge(params.source, params.target)
      ) {
        return
      }

      setEdges((eds) => {
        const alreadyExists = eds.some(
          (edge) =>
            edge.source === params.source &&
            edge.target === params.target &&
            edge.sourceHandle === params.sourceHandle &&
            edge.targetHandle === params.targetHandle
        )

        if (alreadyExists) return eds

        const nextEdges = addEdge(params, eds)
        const businessEdges = nextEdges.filter(
          (edge) =>
            edge.source !== START_ID &&
            edge.source !== END_ID &&
            edge.target !== START_ID &&
            edge.target !== END_ID
        )

        if (hasCycleByEdges(dependency.tree.length, businessEdges)) {
          return eds
        }

        return nextEdges
      })
    },
    [canEditBusinessEdge, dependency.tree.length]
  )

  const onEdgeContextMenu = useCallback(
    (event: ReactMouseEvent, edge: Edge) => {
      event.preventDefault()
      if (!isBusinessEdge(edge)) return
      if (
        canEditBusinessEdge &&
        !canEditBusinessEdge(edge.source, edge.target)
      ) {
        return
      }

      setEdges((currentEdges) =>
        currentEdges.filter((currentEdge) => currentEdge.id !== edge.id)
      )
    },
    [canEditBusinessEdge]
  )

  // Touch/mobile has no right-click: a tap on an editable business edge deletes
  // it (mirrors onEdgeContextMenu). Desktop keeps right-click only.
  const onEdgeClick = useCallback(
    (_event: ReactMouseEvent, edge: Edge) => {
      if (!isMobile) return
      if (!isBusinessEdge(edge)) return
      if (
        canEditBusinessEdge &&
        !canEditBusinessEdge(edge.source, edge.target)
      ) {
        return
      }

      setEdges((currentEdges) =>
        currentEdges.filter((currentEdge) => currentEdge.id !== edge.id)
      )
    },
    [isMobile, canEditBusinessEdge]
  )

  const onNodeClick = useCallback(
    (event: ReactMouseEvent, node: Node) => {
      if (!isBusinessNodeId(node.id)) {
        setSelectedNodeId(null)
        return
      }

      setSelectedNodeId(node.id)

      const data = node.data as TaskNodeData

      // Touch/mobile has no right-click: a tap opens the node menu (which
      // carries "view details"/"delete"), since the label itself does not navigate.
      if (isMobile && data.taskId && (onNodeDetail || onNodeDelete)) {
        setNodeMenu({ x: event.clientX, y: event.clientY, taskId: data.taskId })
        return
      }

      if (data.taskId && onNodeClickProp) {
        onNodeClickProp(data.taskId)
      }
    },
    [onNodeClickProp, isMobile, onNodeDetail, onNodeDelete]
  )

  const handleAutoLayout = useCallback(() => {
    const currentBusinessEdges = edges
      .filter(isBusinessEdge)
      .map((edge) => ({ source: edge.source, target: edge.target }))
    const layout = getBusinessNodeLayout(
      dependency.tree.length,
      currentBusinessEdges
    )

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id === START_ID) {
          return {
            ...node,
            position: { x: layout.centerX, y: layout.minY - START_END_GAP },
          }
        }

        if (node.id === END_ID) {
          return {
            ...node,
            position: { x: layout.centerX, y: layout.maxY + START_END_GAP },
          }
        }

        const nextPosition = layout.positions.get(node.id)
        if (!nextPosition) return node
        return {
          ...node,
          position: nextPosition,
        }
      })
    )
  }, [dependency.tree.length, edges])

  // Re-run the layout automatically whenever the dependency relationships
  // (business edges) change, so the user never has to trigger it by hand.
  // The initial signature is seeded on mount because initNodes are already laid
  // out; only later changes (add/remove edge) drive a relayout.
  const businessEdgeSig = useMemo(
    () => businessEdgeSignature(edges),
    [edges]
  )
  const lastLayoutSigRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastLayoutSigRef.current === null) {
      lastLayoutSigRef.current = businessEdgeSig
      return
    }
    if (lastLayoutSigRef.current === businessEdgeSig) return
    lastLayoutSigRef.current = businessEdgeSig
    handleAutoLayout()
  }, [businessEdgeSig, handleAutoLayout])

  const handleUndo = useCallback(() => {
    setNodes(initNodes)
    setEdges(initEdges)
    setSelectedNodeId(null)
  }, [initNodes, initEdges])
  const handleSave = useCallback(() => {
    onSaveTree?.(nextTree)
  }, [nextTree, onSaveTree])

  // Run the AI over the CURRENT graph, then inject the optimized edges. This
  // enters edit mode (Undo/Save appear) rather than saving — the user commits.
  const handleOptimize = useCallback(async () => {
    const hasKey =
      aiSettings.provider === "deepseek"
        ? !!aiSettings.deepseekApiKey
        : !!aiSettings.openRouterApiKey
    if (!hasKey) {
      setAiError("api")
      return
    }
    setAiError(null)
    setAiPhase("optimizing")
    try {
      const currentDep: DependencyEntity = {
        ...dependency,
        tree: buildTreeFromBusinessEdges(dependency.tree, edges),
      }
      const deps = await optimizeDependencies(
        aiSettings,
        goalTitle ?? "",
        currentDep,
        aiDescription,
        language
      )
      setEdges(buildEdgesFromOptimizeResult(dependency.tree, deps))
      setSelectedNodeId(null)
      setAiOpen(false)
      setAiDescription("")
    } catch (err) {
      setAiError(aiErrorKind(err))
    } finally {
      setAiPhase("idle")
    }
  }, [aiSettings, dependency, edges, goalTitle, aiDescription, language])

  // ── Node context menu ── (state declared above so onNodeClick can open it)
  const onNodeContextMenu = useCallback(
    (event: ReactMouseEvent, node: Node) => {
      event.preventDefault()
      if (!isBusinessNodeId(node.id)) return
      const data = node.data as TaskNodeData
      const id = data.taskId
      if (!id) return
      setNodeMenu({ x: event.clientX, y: event.clientY, taskId: id })
    },
    []
  )

  const closeNodeMenu = useCallback(() => setNodeMenu(null), [])

  return (
    <div className={cn("relative h-full w-full", className)}>
      <ReactFlow
        colorMode={flowColorMode}
        nodeTypes={nodeTypes}
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeContextMenu={onEdgeContextMenu}
        onEdgeClick={onEdgeClick}
        onNodeContextMenu={onNodeContextMenu}
        onNodeClick={onNodeClick}
        onPaneClick={() => {
          setSelectedNodeId(null)
          closeNodeMenu()
        }}
        // On touch, let one-finger drag scroll the page instead of trapping it
        // inside the canvas; pinch-zoom and the Controls still work.
        preventScrolling={!isMobile}
        fitView
      >
        <Panel position="top-right" className="flex items-center">
          <div className="flex items-center gap-2">
            {editMode ? (
              <>
                <Button size="sm" variant="outline" onClick={handleUndo}>
                  {t.flowPanel.undo}
                </Button>
                {showSaveButton ? (
                  <Button size="sm" variant="outline" onClick={handleSave}>
                    {t.common.save}
                  </Button>
                ) : null}
              </>
            ) : null}
            {showAiOptimize && (
              <DependencyAssistPopover
                open={aiOpen}
                onOpenChange={setAiOpen}
                description={aiDescription}
                onDescriptionChange={setAiDescription}
                phase={aiPhase}
                error={aiError}
                onGenerate={handleOptimize}
                onOpenAiSettings={() =>
                  useUiStore.getState().openSettings("ai")
                }
                disabled={dependency.tree.length < 2}
              />
            )}
          </div>
        </Panel>
        <Background />
        <Controls />
      </ReactFlow>

      {showAiOptimize && aiPhase === "optimizing" && (
        <DependencyOptimizingOverlay />
      )}

      {/* Node context menu */}
      {nodeMenu && (onNodeDetail || onNodeDelete) && (
        <>
          {/* Backdrop to close menu on click outside */}
          <div className="fixed inset-0 z-40" onClick={closeNodeMenu} />
          <div
            className="fixed z-50 min-w-32 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
            style={{ left: nodeMenu.x, top: nodeMenu.y }}
          >
            {onNodeDetail && (
              <button
                type="button"
                className="flex w-full items-center rounded-sm px-2 py-1.5 paragraph-small hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  onNodeDetail(nodeMenu.taskId)
                  closeNodeMenu()
                }}
              >
                <ExternalLink className="mr-2 size-4" />
                {t.actions.viewDetails}
              </button>
            )}
            {onNodeDelete && (
              <button
                type="button"
                className="flex w-full items-center rounded-sm px-2 py-1.5 paragraph-small text-destructive hover:bg-destructive/10"
                onClick={() => {
                  onNodeDelete(nodeMenu.taskId)
                  closeNodeMenu()
                }}
              >
                <Trash className="mr-2 size-4" />
                {t.common.delete}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
//MARK: exported FlowPanel components
export type FlowPanelProps = DependencyEntity & {
  className?: string
  goalTitle?: string
  onNodeDetail?: (taskId: string) => void
  onNodeDelete?: (taskId: string) => void
}

function FlowPanel({
  className,
  goalTitle,
  onNodeDetail,
  onNodeDelete,
  ...dependency
}: FlowPanelProps) {
  const { t } = useLanguage()
  const handleSaveTree = useCallback(
    (tree: DependencyEntity["tree"]) => {
      void updateDependency(
        dependency.id,
        { tree },
        t.commands.dependencyUpdateFailed
      )
    },
    [dependency.id, t]
  )

  return (
    <FlowPanelCore
      dependency={dependency}
      className={className}
      navigable
      showSaveButton
      showAiOptimize
      goalTitle={goalTitle}
      onSaveTree={handleSaveTree}
      onNodeDetail={onNodeDetail}
      onNodeDelete={onNodeDelete}
    />
  )
}

export type FlowPanelDraftProps = {
  dependency: DependencyEntity
  className?: string
  draftNodeData?: string
  editableNodeIds?: string[]
  onDraftTreeChange?: (tree: DependencyEntity["tree"]) => void
  onNodeSelect?: (nodeData: string) => void
  onNodeDelete?: (nodeData: string) => void
}

function FlowPanelDraft({
  dependency,
  className,
  draftNodeData,
  editableNodeIds,
  onDraftTreeChange,
  onNodeSelect,
  onNodeDelete,
}: FlowPanelDraftProps) {
  const editableSet = useMemo(
    () => (editableNodeIds ? new Set(editableNodeIds) : null),
    [editableNodeIds]
  )

  const canEditBusinessEdge = useCallback(
    (source: string, target: string) => {
      if (!editableSet || editableSet.size === 0) return true
      return editableSet.has(source) || editableSet.has(target)
    },
    [editableSet]
  )

  return (
    <FlowPanelCore
      dependency={dependency}
      className={className}
      draftNodeData={draftNodeData}
      showSaveButton={false}
      onTreeChange={onDraftTreeChange}
      canEditBusinessEdge={canEditBusinessEdge}
      onNodeClick={onNodeSelect}
      onNodeDelete={onNodeDelete}
    />
  )
}

export type FlowPanelTaskProps = {
  dependency: DependencyEntity
  className?: string
  goalTitle?: string
  highlightNodeData: string
  editableNodeIds?: string[]
  onNodeDetail?: (taskId: string) => void
  onNodeDelete?: (taskId: string) => void
}

function FlowPanelTask({
  dependency,
  className,
  goalTitle,
  highlightNodeData,
  editableNodeIds,
  onNodeDetail,
  onNodeDelete,
}: FlowPanelTaskProps) {
  const { t } = useLanguage()
  const editableSet = useMemo(
    () => (editableNodeIds ? new Set(editableNodeIds) : null),
    [editableNodeIds]
  )

  const canEditBusinessEdge = useCallback(
    (source: string, target: string) => {
      if (!editableSet || editableSet.size === 0) return true
      return editableSet.has(source) || editableSet.has(target)
    },
    [editableSet]
  )

  const handleSaveTree = useCallback(
    (tree: DependencyEntity["tree"]) => {
      void updateDependency(
        dependency.id,
        { tree },
        t.commands.dependencyUpdateFailed
      )
    },
    [dependency.id, t]
  )

  return (
    <FlowPanelCore
      dependency={dependency}
      className={className}
      navigable
      draftNodeData={highlightNodeData}
      showSaveButton
      showAiOptimize
      goalTitle={goalTitle}
      onSaveTree={handleSaveTree}
      canEditBusinessEdge={canEditBusinessEdge}
      onNodeDetail={onNodeDetail}
      onNodeDelete={onNodeDelete}
    />
  )
}

export { FlowPanel, FlowPanelDraft, FlowPanelTask }
