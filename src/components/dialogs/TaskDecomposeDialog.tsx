import * as React from "react"
import { Plus, Sparkles, Trash2 } from "lucide-react"

import { useLanguage } from "@/components/shared/language-provider"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

// ── Public types ──────────────────────────────────────────

export interface DecomposeTaskBadge {
  id: string
  title: string
  /** Present = maps to an existing task: edits update it, and it can't be deleted. */
  taskId?: string
  /** User-selected for AI (re)fill. Empty badges are implicit fill targets. */
  selected?: boolean
  /** Currently being AI-filled → rendered as a skeleton. */
  filling?: boolean
}

/** idle = editable; counting = deciding an initial count (no badges yet). */
export type DecomposePhase = "idle" | "counting"

/** network = connection/transport failure; api = provider/config/auth failure. */
export type DecomposeErrorKind = "network" | "api"

export interface TaskDecomposeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goalTitle: string
  description: string
  onDescriptionChange: (value: string) => void
  /** All badges — existing tasks (with taskId) and new ones, controlled. */
  tasks: DecomposeTaskBadge[]
  onTasksChange: (next: DecomposeTaskBadge[]) => void
  onToggleSelect: (id: string) => void
  phase?: DecomposePhase
  /** Whether any AI request is in flight (drives the button spinner). */
  busy?: boolean
  error?: DecomposeErrorKind | null
  /**
   * Fire the AI. With no badges: decide a count first, then fill. With badges:
   * fill the selected + empty ones.
   */
  onGenerate: () => void
  onConfirm: () => void
  onOpenAiSettings?: () => void
}

function newTaskId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `badge-${Math.floor(Math.random() * 1e9).toString(36)}`
}

// ── Editable, selectable badge ────────────────────────────

function TaskBadge({
  badge,
  placeholder,
  deleteLabel,
  disabled,
  onChange,
  onToggle,
  onRemove,
}: {
  badge: DecomposeTaskBadge
  placeholder: string
  deleteLabel: string
  disabled: boolean
  onChange: (value: string) => void
  onToggle: () => void
  onRemove: () => void
}) {
  const [hovered, setHovered] = React.useState(false)

  if (badge.filling) {
    return <Skeleton className="h-8 w-32 rounded-md" />
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Click the pill (its padding/edge) to toggle selection; the inner input
          stops propagation so clicking to edit never toggles. */}
      <Badge
        variant="secondary"
        size="lg"
        onClick={disabled ? undefined : onToggle}
        className={cn(
          "h-auto cursor-pointer rounded-md bg-muted px-2.5 py-1 text-foreground",
          badge.selected && "ring-2 ring-primary"
        )}
      >
        <Input
          value={badge.title}
          placeholder={placeholder}
          disabled={disabled}
          // Auto-fit to content: field-sizing where supported, `size` as the
          // fallback (mirrors StepsItem's inline editor).
          size={Math.max(badge.title.length, 1)}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "field-sizing-content h-5 max-w-48 cursor-text border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 dark:bg-transparent",
            // Floor only when empty, so filled badges hug their text exactly.
            !badge.title.trim() && "min-w-16"
          )}
        />
      </Badge>
      {hovered && !disabled && (
        <Button
          type="button"
          variant="destructive"
          size="icon-xs"
          aria-label={deleteLabel}
          onClick={onRemove}
          className="absolute -top-2 -right-2 rounded-full shadow-sm"
        >
          <Trash2 />
        </Button>
      )}
    </div>
  )
}

function SkeletonBadges({ widths }: { widths: string[] }) {
  return (
    <>
      {widths.map((w, i) => (
        <Skeleton key={i} className={cn("h-8 rounded-md", w)} />
      ))}
    </>
  )
}

// ── Dialog ────────────────────────────────────────────────

export function TaskDecomposeDialog({
  open,
  onOpenChange,
  goalTitle,
  description,
  onDescriptionChange,
  tasks,
  onTasksChange,
  onToggleSelect,
  phase = "idle",
  busy = false,
  error = null,
  onGenerate,
  onConfirm,
  onOpenAiSettings,
}: TaskDecomposeDialogProps) {
  const { t } = useLanguage()

  const inputsDisabled = busy
  const hasNamedTask = tasks.some((t) => t.title.trim().length > 0)
  // Generate has a fill target only when: no badges yet (count-then-fill),
  // some badge is empty (implicit target), or one is selected for refill.
  const hasGenerateTarget =
    tasks.length === 0 ||
    tasks.some((t) => !t.title.trim() || t.selected)

  const addTask = () =>
    onTasksChange([...tasks, { id: newTaskId(), title: "" }])
  const updateTask = (id: string, title: string) =>
    onTasksChange(tasks.map((t) => (t.id === id ? { ...t, title } : t)))
  const removeTask = (id: string) =>
    onTasksChange(tasks.filter((t) => t.id !== id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.ai.decompose.title}</DialogTitle>
          <DialogDescription>{t.ai.decompose.subtitle}</DialogDescription>
        </DialogHeader>

        {/* Goal (read-only) */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t.ai.decompose.goalLabel}
          </span>
          <div className="truncate rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">
            {goalTitle}
          </div>
        </div>

        {/* Prompt + generate button, with inline error */}
        <Field data-invalid={error ? true : undefined}>
          <InputGroup aria-invalid={error ? true : undefined}>
            <InputGroupTextarea
              value={description}
              placeholder={t.ai.decompose.placeholder}
              disabled={inputsDisabled}
              rows={3}
              onChange={(e) => onDescriptionChange(e.target.value)}
            />
            <InputGroupAddon align="block-end">
              {phase === "counting" && (
                <InputGroupText>
                  <Spinner className="size-3" />
                  {t.ai.decompose.counting}
                </InputGroupText>
              )}
              <InputGroupButton
                variant="default"
                size="sm"
                className="ml-auto"
                disabled={busy || !hasGenerateTarget}
                onClick={onGenerate}
              >
                {busy ? <Spinner className="size-3" /> : <Sparkles />}
                {t.ai.decompose.generate}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {error && (
            <FieldDescription className="flex flex-wrap items-center gap-1 text-destructive">
              {error === "network" ? t.ai.errorNetwork : t.ai.errorApi}
              {onOpenAiSettings && (
                <button
                  type="button"
                  onClick={onOpenAiSettings}
                  className="font-medium text-destructive underline underline-offset-4 hover:opacity-80"
                >
                  {t.ai.goSettings}
                </button>
              )}
            </FieldDescription>
          )}
        </Field>

        {/* Task badges */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {t.ai.decompose.tasksLabel}
              <span className="ml-1 text-muted-foreground">
                ({tasks.length})
              </span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={t.ai.decompose.add}
              disabled={busy}
              onClick={addTask}
            >
              <Plus />
            </Button>
          </div>

          <ScrollArea className="h-24 w-full">
            <div className="flex min-h-full flex-wrap content-start gap-2 pt-2 pr-2">
              {phase === "counting" ? (
                <SkeletonBadges widths={["w-28", "w-24", "w-32"]} />
              ) : tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t.ai.decompose.empty}
                </p>
              ) : (
                tasks.map((task) => (
                  <TaskBadge
                    key={task.id}
                    badge={task}
                    placeholder={t.ai.decompose.taskPlaceholder}
                    deleteLabel={t.ai.decompose.deleteTask}
                    disabled={inputsDisabled}
                    onChange={(title) => updateTask(task.id, title)}
                    onToggle={() => onToggleSelect(task.id)}
                    onRemove={() => removeTask(task.id)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t.ai.decompose.cancel}
          </Button>
          <Button
            type="button"
            disabled={busy || !hasNamedTask}
            onClick={onConfirm}
          >
            {t.ai.decompose.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
