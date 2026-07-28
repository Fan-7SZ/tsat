import { useCallback, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { HelpTooltip } from "@/components/shared/HelpTooltip"
import { useHomePageVM } from "@/hooks/use-page-view-models"
import { useGoalMap } from "@/hooks/use-entities"
import { useTagMap } from "@/hooks/use-tags"
import { usePlannerState } from "@/store/planner-state-store"
import { useLanguage } from "@/components/shared/language-provider"
import {
  generateICS,
  downloadICS,
  type IcsEvent,
} from "@/services/planner/ics-export"
import { toLocalDateKey } from "@/utils/date"
import { Download, X, Clock, CalendarPlus, ChevronDown } from "lucide-react"
import {
  GanttPanel,
  type GanttPanelRow,
} from "@/components/gantt/GanttPanel"
import type { GoalID } from "@/domain/value-objects/types"

interface PlannerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PlannerDialog({ open, onOpenChange }: PlannerDialogProps) {
  const { t } = useLanguage()
  const vm = useHomePageVM()
  const goalMap = useGoalMap()
  const tagMap = useTagMap()

  const blocks = usePlannerState((s) => s.blocks)
  const addBlock = usePlannerState((s) => s.addBlock)
  const updateBlock = usePlannerState((s) => s.updateBlock)
  const removeBlock = usePlannerState((s) => s.removeBlock)
  const ensureToday = usePlannerState((s) => s.ensureToday)

  // Drop stale blocks when the day rolls over while the app was open.
  useEffect(() => {
    if (open) ensureToday()
  }, [open, ensureToday])

  // Resolve a task's goal color via its goal's tag.
  const colorFor = useCallback(
    (goalId?: GoalID): string | undefined => {
      if (!goalId) return undefined
      const tagId = goalMap[goalId]?.tagId
      return tagId ? tagMap[tagId]?.color : undefined
    },
    [goalMap, tagMap]
  )

  // Every today-task (todo + in-progress) is a gantt row.
  const rows = useMemo<GanttPanelRow[]>(() => {
    const items = [...vm.todayTasks.todo, ...vm.todayTasks.inProgress]
    return items.map((task) => ({
      runtimeId: task.runtimeId,
      taskId: task.taskId,
      title: task.title,
      goalTitle: task.goalTitle,
      color: colorFor(task.goalId),
      estimatedDuration: task.estimatedDuration,
    }))
  }, [vm.todayTasks, colorFor])

  const titleByRuntime = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.runtimeId, r.title])),
    [rows]
  )

  const blockCount = useMemo(
    () => Object.values(blocks).reduce((n, list) => n + list.length, 0),
    [blocks]
  )

  // Flatten the planner result into calendar events for export.
  const makeICSBlob = useCallback(() => {
    const today = toLocalDateKey(new Date())
    const events: IcsEvent[] = []
    for (const [runtimeId, list] of Object.entries(blocks)) {
      const title = titleByRuntime[runtimeId]
      if (!title) continue // block for a task not scheduled today
      for (const b of list) {
        events.push({
          title,
          dateKey: today,
          startMinute: b.from,
          durationMinutes: b.to - b.from,
        })
      }
    }
    return generateICS(events)
  }, [blocks, titleByRuntime])

  const handleExportICS = useCallback(async () => {
    const blob = await makeICSBlob()
    if (blob) {
      const today = toLocalDateKey(new Date())
      downloadICS(blob, `schedule-${today}.ics`)
    }
  }, [makeICSBlob])

  const handleImportCalendar = useCallback(async () => {
    const blob = await makeICSBlob()
    if (blob) {
      const url = URL.createObjectURL(blob)
      // Anchor click without `download`: Safari opens Calendar.app; Chrome
      // silently downloads (no blank tab).
      const a = document.createElement("a")
      a.href = url
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }
  }, [makeICSBlob])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
        showCloseButton={false}
        // Don't auto-focus the first control (the "?" help button) on open —
        // a focused Radix tooltip trigger would pop its tooltip immediately.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <DialogTitle>{t.planner.title}</DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            <HelpTooltip content={t.planner.help} label={t.planner.helpTitle} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={blockCount === 0}>
                  <Download className="mr-1 h-3.5 w-3.5" />
                  {t.planner.export}
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleImportCalendar}>
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  {t.planner.importCalendar}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportICS}>
                  <Download className="mr-2 h-4 w-4" />
                  {t.planner.exportFile}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DialogClose asChild>
              <Button variant="ghost" size="icon-sm">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>
        </div>

        <div className="min-h-0 flex-1 px-4 pb-4">
          <GanttPanel
            rows={rows}
            blocksByRuntime={blocks}
            onCreate={addBlock}
            onResize={updateBlock}
            onRemove={removeBlock}
            initialPx={2}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
