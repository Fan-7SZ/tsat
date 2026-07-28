import { CalendarIcon, Plus, Trash } from "lucide-react"

import type { LocalDateKey } from "@/domain/value-objects/schemas"
import type { RepeatPointStatus } from "@/domain/entities/RepeatLedgerEntity"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useLanguage } from "@/components/shared/language-provider"
import { parseDateKey, toLocalDateKey } from "@/utils/date"

export interface CompletionRecordRow {
  id: string
  date: string
}

export interface RepeatPointRow {
  dateKey: string
  status: RepeatPointStatus
}

export interface CompletionRecordsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "records" | "repeat"
  // ── records mode (editable: counter / trigger) ──
  records?: CompletionRecordRow[]
  onAddRow?: () => void
  onQuickAddToday?: () => void
  onRemoveRow?: (id: string) => void
  onChangeDate?: (id: string, date: string) => void
  // ── repeat mode (status-only, no add) ──
  points?: RepeatPointRow[]
  onChangeStatus?: (dateKey: string, status: RepeatPointStatus) => void
}

/**
 * Presentational dialog listing a task's completion records. In "records" mode
 * (counter / trigger) the user can add / remove / re-date rows; in "repeat"
 * mode the planned points are read-only dates whose status can be changed.
 * Fully controlled — no store / command / DB access.
 */
export function CompletionRecordsDialog({
  open,
  onOpenChange,
  mode,
  records = [],
  onAddRow,
  onQuickAddToday,
  onRemoveRow,
  onChangeDate,
  points = [],
  onChangeStatus,
}: CompletionRecordsDialogProps) {
  const { t } = useLanguage()

  const statusOptions: RepeatPointStatus[] = [
    "planned",
    "completed",
    "skipped",
  ]
  const statusLabel = (status: RepeatPointStatus) =>
    status === "completed"
      ? t.taskDetail.pointCompleted
      : status === "skipped"
        ? t.taskDetail.pointSkipped
        : t.taskDetail.pointPlanned

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0 pr-8">
          <div className="flex flex-col gap-1">
            <DialogTitle>{t.taskDetail.completionRecords}</DialogTitle>
            <DialogDescription className="sr-only">
              {t.taskDetail.completionRecords}
            </DialogDescription>
          </div>
          {mode === "records" && (
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" onClick={onQuickAddToday}>
                <Plus data-icon="inline-start" />
                {t.taskDetail.quickAddToday}
              </Button>
              <Button size="sm" variant="outline" onClick={onAddRow}>
                {t.taskDetail.addRow}
              </Button>
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[55vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.taskDetail.colDate}</TableHead>
                {mode === "records" ? (
                  <TableHead className="w-16 text-right">
                    {t.taskDetail.colActions}
                  </TableHead>
                ) : (
                  <TableHead className="w-40">
                    {t.taskDetail.colStatus}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {mode === "records"
                ? records.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Popover modal>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full justify-between font-normal"
                            >
                              {row.date}
                              <CalendarIcon className="text-muted-foreground" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto p-0"
                            align="start"
                          >
                            <Calendar
                              mode="single"
                              selected={parseDateKey(row.date as LocalDateKey)}
                              defaultMonth={parseDateKey(
                                row.date as LocalDateKey
                              )}
                              onSelect={(date) => {
                                if (date) {
                                  onChangeDate?.(row.id, toLocalDateKey(date))
                                }
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onRemoveRow?.(row.id)}
                        >
                          <Trash />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                : points.map((point) => (
                    <TableRow key={point.dateKey}>
                      <TableCell className="font-medium">
                        {point.dateKey}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={point.status}
                          onValueChange={(value) =>
                            onChangeStatus?.(
                              point.dateKey,
                              value as RepeatPointStatus
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((status) => (
                              <SelectItem key={status} value={status}>
                                {statusLabel(status)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
