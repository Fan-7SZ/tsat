import { useCallback, useMemo, useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type Column,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type RowData,
} from "@tanstack/react-table"
import {
  ArrowUpDown,
  ExternalLink,
  MoreHorizontal,
  Trash,
} from "lucide-react"
import { useLoaderData, useNavigate } from "react-router"
import type { ListPagesSnapshot } from "@/hooks/use-page-view-models"
import { NavHistoryButtons } from "@/components/shared/NavHistoryButtons"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTable } from "@/components/shared/DataTable"
import { ConfirmDeleteDialog } from "@/components/dialogs/ConfirmDeleteDialog"
import { GoalSelect } from "@/components/goal/GoalSelect"
import { useTaskGoalRebind } from "@/hooks/use-task-goal-rebind"
import { deleteTask } from "@/commands/task.commands"
import { useAllTasksPageVM } from "@/hooks/use-page-view-models"
import { useGoalMap } from "@/hooks/use-entities"
import { useTagMap } from "@/hooks/use-tags"
import { useLanguage } from "@/components/shared/language-provider"
import type { AllTasksRowVM } from "@/domain/view-models/AllTasksPageVM"
import type { GoalID, TaskID } from "@/domain/value-objects/types"
import type { Dictionary } from "@/i18n/types"
import {
  compareCompletion,
  compareDuration,
  compareGoal,
  compareStatus,
} from "@/utils/all-tasks-sort"

// ── Table meta type (for passing callbacks to cells) ──

type AllTasksTableMeta = {
  requestDelete: (taskId: TaskID) => void
  requestRebind: (taskId: TaskID, goalId: GoalID | undefined) => void
}

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    requestDelete: (taskId: TaskID) => void
    requestRebind: (taskId: TaskID, goalId: GoalID | undefined) => void
  }
}

// ── Stable row-model factories (called once at module level) ──

const coreRowModel = getCoreRowModel<AllTasksRowVM>()
const filteredRowModel = getFilteredRowModel<AllTasksRowVM>()
const sortedRowModel = getSortedRowModel<AllTasksRowVM>()
const paginationRowModel = getPaginationRowModel<AllTasksRowVM>()

const FILTER_VALUE_ALL = "__all__"
const FILTER_VALUE_NONE = "__none__"
const COMPLETION_FILTER_COMPLETED = "__completed__"
const COMPLETION_FILTER_INCOMPLETE = "__incomplete__"

function isTaskCompleted(
  task: Pick<AllTasksRowVM, "completedCount" | "totalCount">
) {
  return task.totalCount > 0 && task.completedCount >= task.totalCount
}

// ── Columns ──

// Reusable sortable column header: a ghost button that toggles asc/desc, with
// the ↕ affordance. Shared by all sortable columns.
function sortableHeader(label: string) {
  return function SortHeader({
    column,
  }: {
    column: Column<AllTasksRowVM, unknown>
  }) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        {label}
        <ArrowUpDown className="ml-1 size-3.5" />
      </Button>
    )
  }
}

function createColumns(
  t: Dictionary,
  resolveGoalColor: (goalId?: GoalID) => string | undefined
): ColumnDef<AllTasksRowVM, unknown>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t.dataTable.selectAll}
        />
      ),
      cell: ({ row }) => (
        // Stop propagation so toggling selection doesn't trigger the row's
        // navigate-to-detail click.
        <span
          className="inline-flex"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={t.dataTable.selectRow}
          />
        </span>
      ),
      enableSorting: false,
      enableColumnFilter: false,
      meta: { align: "left" },
    },
    {
      accessorKey: "title",
      header: t.allTasks.columnTitle,
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("title")}</span>
      ),
    },
    {
      accessorKey: "goalTitle",
      header: sortableHeader(t.allTasks.columnGoal),
      sortingFn: (rowA, rowB) => compareGoal(rowA.original, rowB.original),
      cell: function GoalCell({ row, table }) {
        const { taskId, goalId } = row.original
        const color = resolveGoalColor(goalId)
        // Inline editing: picking a goal re-binds the task (the page-level hook
        // handles any confirm / bridge dialogs). stopPropagation keeps the
        // row's navigate-to-task click from firing while interacting.
        return (
          <span
            className="flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {color && (
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
            )}
            <GoalSelect
              value={goalId}
              onChange={(next) =>
                table.options.meta?.requestRebind(taskId, next)
              }
              aria-label={t.goalRebind.label}
              triggerClassName="h-8 border-none bg-transparent px-1 shadow-none hover:bg-muted"
            />
          </span>
        )
      },
      filterFn: (row, _columnId, filterValue) => {
        if (!filterValue || filterValue === FILTER_VALUE_ALL) return true
        return row.original.goalId === filterValue
      },
    },
    {
      accessorKey: "runtimeStatus",
      header: sortableHeader(t.allTasks.columnStatus),
      sortingFn: (rowA, rowB) => compareStatus(rowA.original, rowB.original),
      cell: ({ row }) => {
        const status = row.original.runtimeStatus
        if (!status) {
          return <Badge variant="outline">{t.status.notScheduled}</Badge>
        }
        const map = {
          todo: { label: t.status.todo, variant: "secondary" as const },
          inProgress: {
            label: t.status.inProgress,
            variant: "default" as const,
          },
          done: { label: t.status.done, variant: "default" as const },
        }
        const { label, variant } = map[status]
        return <Badge variant={variant}>{label}</Badge>
      },
      filterFn: (row, _columnId, filterValue) => {
        if (!filterValue || filterValue === FILTER_VALUE_ALL) return true
        if (filterValue === FILTER_VALUE_NONE)
          return row.original.runtimeStatus === null
        return row.original.runtimeStatus === filterValue
      },
    },
    {
      id: "completion",
      accessorFn: (row) =>
        isTaskCompleted(row)
          ? COMPLETION_FILTER_COMPLETED
          : COMPLETION_FILTER_INCOMPLETE,
      header: sortableHeader(t.allTasks.columnCompletion),
      sortingFn: (rowA, rowB) =>
        compareCompletion(rowA.original, rowB.original),
      cell: ({ row }) => {
        const { completedCount, totalCount } = row.original
        if (totalCount === 0) return <Badge variant="outline">—</Badge>
        if (isTaskCompleted(row.original)) {
          return <Badge variant="default">{t.status.completed}</Badge>
        }
        return (
          <Badge variant="secondary">
            {completedCount}/{totalCount}
          </Badge>
        )
      },
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue || filterValue === FILTER_VALUE_ALL) return true
        return row.getValue(columnId) === filterValue
      },
    },
    {
      accessorKey: "dueAt",
      header: sortableHeader(t.allTasks.columnDueDate),
      cell: ({ row }) => row.original.dueAtLabel ?? "—",
      sortingFn: (rowA, rowB) => {
        const a = rowA.original.dueAt
        const b = rowB.original.dueAt
        if (a && b) return a.getTime() - b.getTime()
        if (a) return -1
        if (b) return 1
        return 0
      },
    },
    {
      accessorKey: "estimatedDuration",
      header: sortableHeader(t.allTasks.columnDuration),
      sortingFn: (rowA, rowB) => compareDuration(rowA.original, rowB.original),
      cell: ({ row }) => {
        const d = row.getValue<number | undefined>("estimatedDuration")
        return d != null ? `${d} ${t.allTasks.minLabel}` : "—"
      },
    },
    {
      id: "actions",
      cell: function ActionsCell({ row, table }) {
        const navigate = useNavigate()
        const { t } = useLanguage()
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => navigate(`/tasks/${row.original.taskId}`)}
              >
                <ExternalLink className="mr-2 size-4" />
                {t.allTasks.viewDetails}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() =>
                  table.options.meta?.requestDelete(row.original.taskId)
                }
              >
                <Trash className="mr-2 size-4" />
                {t.common.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      enableSorting: false,
      enableColumnFilter: false,
    },
  ]
}

// ── Page ──

export function AllTasks() {
  const initial = useLoaderData<ListPagesSnapshot>()
  const vm = useAllTasksPageVM(initial)
  const navigate = useNavigate()
  const { t } = useLanguage()

  const goalRebind = useTaskGoalRebind()
  const goalMap = useGoalMap(initial?.goals)
  const tagMap = useTagMap()
  const resolveGoalColor = useCallback(
    (goalId?: GoalID) => {
      const tagId = goalId ? goalMap[goalId]?.tagId : undefined
      return tagId ? tagMap[tagId]?.color : undefined
    },
    [goalMap, tagMap]
  )

  const columns = useMemo(
    () => createColumns(t, resolveGoalColor),
    [t, resolveGoalColor]
  )

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = useState({})

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<TaskID[] | null>(null)

  // Row context menu state
  const [rowMenu, setRowMenu] = useState<{
    x: number
    y: number
    taskId: TaskID
  } | null>(null)

  const handleRowContextMenu = useCallback(
    (event: React.MouseEvent, row: AllTasksRowVM) => {
      event.preventDefault()
      setRowMenu({ x: event.clientX, y: event.clientY, taskId: row.taskId })
    },
    []
  )

  // Stable data reference — only changes when the VM changes
  const data = useMemo(() => vm.rows, [vm.rows])

  // Stable getRowId
  const getRowId = useCallback((row: AllTasksRowVM) => row.taskId, [])

  // Table meta: pass delete callback without injecting into data
  const meta = useMemo<AllTasksTableMeta>(
    () => ({
      requestDelete: (taskId: TaskID) => setDeleteTarget([taskId]),
      requestRebind: (taskId: TaskID, goalId: GoalID | undefined) =>
        void goalRebind.requestRebind(taskId, goalId),
    }),
    [goalRebind]
  )

  // TanStack Table's useReactTable is flagged by the React Compiler lint rule.
  // This page depends on that API directly, so suppress the library-specific warning here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: coreRowModel,
    getFilteredRowModel: filteredRowModel,
    getSortedRowModel: sortedRowModel,
    getPaginationRowModel: paginationRowModel,
    getRowId,
    enableRowSelection: true,
    meta,
  })

  const selectedCount = table.getFilteredSelectedRowModel().rows.length

  const handleBatchDelete = () => {
    const ids = table
      .getFilteredSelectedRowModel()
      .rows.map((r) => r.original.taskId)
    setDeleteTarget(ids)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    for (const id of deleteTarget) {
      await deleteTask(id, t.commands.taskDeleteFailed)
    }
    setDeleteTarget(null)
    setRowSelection({})
  }

  return (
    <div className="flex min-h-full flex-col lg:h-full">
      <PageHeader>
        <AllTasksHeader
          selectedCount={selectedCount}
          onBatchDelete={handleBatchDelete}
        />
      </PageHeader>
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={t.allTasks.deleteTasksTitle(deleteTarget?.length ?? 0)}
        description={t.allTasks.deleteTasksDescription}
        onConfirm={() => {
          void confirmDelete()
        }}
      />
      {goalRebind.dialogs}
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4">
        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <Input
            placeholder={t.allTasks.searchPlaceholder}
            value={(table.getColumn("title")?.getFilterValue() as string) ?? ""}
            onChange={(e) =>
              table.getColumn("title")?.setFilterValue(e.target.value)
            }
            className="max-w-xs"
          />
          <Select
            value={
              (table.getColumn("goalTitle")?.getFilterValue() as string) ??
              FILTER_VALUE_ALL
            }
            onValueChange={(v) =>
              table
                .getColumn("goalTitle")
                ?.setFilterValue(v === FILTER_VALUE_ALL ? "" : v)
            }
          >
            <SelectTrigger className="w-45">
              <SelectValue placeholder={t.allTasks.allGoals} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_VALUE_ALL}>
                {t.allTasks.allGoals}
              </SelectItem>
              {vm.goalOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={
              (table.getColumn("runtimeStatus")?.getFilterValue() as string) ??
              FILTER_VALUE_ALL
            }
            onValueChange={(v) =>
              table
                .getColumn("runtimeStatus")
                ?.setFilterValue(v === FILTER_VALUE_ALL ? "" : v)
            }
          >
            <SelectTrigger className="w-45">
              <SelectValue placeholder={t.allTasks.allStatuses} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_VALUE_ALL}>
                {t.allTasks.allStatuses}
              </SelectItem>
              <SelectItem value={FILTER_VALUE_NONE}>
                {t.status.notScheduled}
              </SelectItem>
              <SelectItem value="todo">{t.status.todo}</SelectItem>
              <SelectItem value="inProgress">{t.status.inProgress}</SelectItem>
              <SelectItem value="done">{t.status.done}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={
              (table.getColumn("completion")?.getFilterValue() as string) ??
              FILTER_VALUE_ALL
            }
            onValueChange={(v) =>
              table
                .getColumn("completion")
                ?.setFilterValue(v === FILTER_VALUE_ALL ? "" : v)
            }
          >
            <SelectTrigger className="w-45">
              <SelectValue placeholder={t.allTasks.allCompletion} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_VALUE_ALL}>
                {t.allTasks.allCompletion}
              </SelectItem>
              <SelectItem value={COMPLETION_FILTER_COMPLETED}>
                {t.allTasks.completedOnly}
              </SelectItem>
              <SelectItem value={COMPLETION_FILTER_INCOMPLETE}>
                {t.allTasks.incompleteOnly}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DataTable
          table={table}
          columns={columns}
          className="min-h-0 flex-1 shadow"
          pagination
          onRowContextMenu={handleRowContextMenu}
          onRowClick={(row) => navigate(`/tasks/${row.taskId}`)}
        />
      </div>

      {/* Row context menu */}
      {rowMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setRowMenu(null)}
          />
          <div
            className="fixed z-50 min-w-32 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
            style={{ left: rowMenu.x, top: rowMenu.y }}
          >
            <button
              type="button"
              className="flex w-full items-center rounded-sm px-2 py-1.5 paragraph-small hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                navigate(`/tasks/${rowMenu.taskId}`)
                setRowMenu(null)
              }}
            >
              <ExternalLink className="mr-2 size-4" />
              {t.allTasks.viewDetails}
            </button>
            <button
              type="button"
              className="flex w-full items-center rounded-sm px-2 py-1.5 paragraph-small text-destructive hover:bg-destructive/10"
              onClick={() => {
                setDeleteTarget([rowMenu.taskId])
                setRowMenu(null)
              }}
            >
              <Trash className="mr-2 size-4" />
              {t.common.delete}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Header ──

function AllTasksHeader({
  selectedCount,
  onBatchDelete,
}: {
  selectedCount: number
  onBatchDelete: () => void
}) {
  const { t } = useLanguage()
  return (
    <div className="flex w-full items-center px-4">
      <div className="flex items-center gap-2">
        <NavHistoryButtons />
        <span className="paragraph-regular">{t.allTasks.title}</span>
      </div>
      <div className="ml-auto flex gap-1">
        {selectedCount > 0 && (
          <Button variant="destructive" size="lg" onClick={onBatchDelete}>
            <Trash />
            {t.allTasks.deleteCount(selectedCount)}
          </Button>
        )}
      </div>
    </div>
  )
}
