import { useEffect, useRef, useState } from "react"

import { useLanguage } from "@/components/shared/language-provider"
import { useAppStore } from "@/store/app-store"
import { useUiStore } from "@/store/ui-store"
import { extractAiError } from "@/services/ai/ai"
import {
  decomposeGoalTasks,
  estimateTaskCount,
} from "@/services/ai/ai-scenarios"
import {
  TaskDecomposeDialog,
  type DecomposeErrorKind,
  type DecomposePhase,
  type DecomposeTaskBadge,
} from "@/components/dialogs/TaskDecomposeDialog"

/** What the confirm produces: renamed existing tasks, new titles, deleted ids. */
export interface DecomposeCommit {
  updated: Array<{ taskId: string; title: string }>
  created: string[]
  /** Existing task ids whose badge was removed in the panel. */
  deleted: string[]
}

export interface TaskDecomposeDialogContainerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goalTitle: string
  goalDescription?: string
  /** Tasks already on the goal — shown as editable badges (rename = update). */
  existingTasks?: Array<{ id: string; title: string }>
  /** Persist the diff. Return true on success so the dialog can close. */
  onCommit: (commit: DecomposeCommit) => Promise<boolean>
}

function newBadgeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `badge-${Math.floor(Math.random() * 1e9).toString(36)}`
}

function errorKind(err: unknown): DecomposeErrorKind {
  const { code } = extractAiError(err)
  return code === "timeout" ||
    code === "serverError" ||
    code === "badGateway" ||
    code === "serviceUnavailable"
    ? "network"
    : "api"
}

/**
 * Stateful wrapper around TaskDecomposeDialog. Existing tasks become editable
 * badges; generating fills the selected + empty badges (per-badge skeleton), or,
 * with no badges, counts first then fills. Confirm hands a rename/create diff to
 * `onCommit` (empty badges dropped, existing tasks never deleted here).
 */
export function TaskDecomposeDialogContainer({
  open,
  onOpenChange,
  goalTitle,
  goalDescription,
  existingTasks = [],
  onCommit,
}: TaskDecomposeDialogContainerProps) {
  const { language } = useLanguage()
  const aiSettings = useAppStore((s) => s.aiSettings)

  const [description, setDescription] = useState("")
  const [tasks, setTasks] = useState<DecomposeTaskBadge[]>([])
  const [phase, setPhase] = useState<DecomposePhase>("idle")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<DecomposeErrorKind | null>(null)
  // Original titles per existing task, to diff renames on confirm.
  const originalTitles = useRef<Map<string, string>>(new Map())

  // Seed the badge list from existing tasks each time the dialog opens.
  const prevOpen = useRef(false)
  useEffect(() => {
    if (open && !prevOpen.current) {
      originalTitles.current = new Map(
        existingTasks.map((t) => [t.id, t.title])
      )
      setTasks(
        existingTasks.map((t) => ({ id: t.id, title: t.title, taskId: t.id }))
      )
      setDescription("")
      setPhase("idle")
      setBusy(false)
      setError(null)
    }
    prevOpen.current = open
  }, [open, existingTasks])

  const hasKey =
    aiSettings.provider === "deepseek"
      ? !!aiSettings.deepseekApiKey
      : !!aiSettings.openRouterApiKey

  const toggleSelect = (id: string) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    )

  const handleGenerate = async () => {
    if (!hasKey) {
      setError("api")
      return
    }
    setError(null)

    // No badges → decide a count, then fill that many.
    if (tasks.length === 0) {
      setPhase("counting")
      setBusy(true)
      try {
        const count = await estimateTaskCount(
          aiSettings,
          { title: goalTitle, description: goalDescription },
          description,
          language
        )
        const seeds: DecomposeTaskBadge[] = Array.from(
          { length: count },
          () => ({ id: newBadgeId(), title: "", filling: true })
        )
        setTasks(seeds)
        setPhase("idle")
        const titles = await decomposeGoalTasks(
          aiSettings,
          { title: goalTitle, description: goalDescription },
          description,
          language,
          undefined,
          count
        )
        setTasks(
          seeds.map((b, i) => ({
            ...b,
            title: titles[i] ?? "",
            filling: false,
          }))
        )
      } catch (err) {
        setError(errorKind(err))
        setTasks([])
      } finally {
        setPhase("idle")
        setBusy(false)
      }
      return
    }

    // With badges → fill the selected + empty ones only.
    const targetIds = new Set(
      tasks.filter((t) => t.selected || t.title.trim() === "").map((t) => t.id)
    )
    if (targetIds.size === 0) return
    const keptTitles = tasks
      .filter((t) => !targetIds.has(t.id) && t.title.trim())
      .map((t) => t.title)

    setTasks((prev) =>
      prev.map((t) => (targetIds.has(t.id) ? { ...t, filling: true } : t))
    )
    setBusy(true)
    try {
      const titles = await decomposeGoalTasks(
        aiSettings,
        {
          title: goalTitle,
          description: goalDescription,
          existingTaskTitles: keptTitles,
        },
        description,
        language,
        undefined,
        targetIds.size
      )
      let i = 0
      setTasks((prev) =>
        prev.map((t) => {
          if (!targetIds.has(t.id)) return t
          const title = titles[i++] ?? t.title
          return { ...t, title, filling: false, selected: false }
        })
      )
    } catch (err) {
      setError(errorKind(err))
      setTasks((prev) =>
        prev.map((t) => (targetIds.has(t.id) ? { ...t, filling: false } : t))
      )
    } finally {
      setBusy(false)
    }
  }

  const handleConfirm = async () => {
    const named = tasks.filter((t) => t.title.trim().length > 0)
    const updated = named
      .filter(
        (t) =>
          t.taskId && t.title.trim() !== originalTitles.current.get(t.taskId)
      )
      .map((t) => ({ taskId: t.taskId as string, title: t.title.trim() }))
    const created = named.filter((t) => !t.taskId).map((t) => t.title.trim())

    // Existing tasks whose badge was removed → delete them.
    const currentTaskIds = new Set(
      tasks.filter((t) => t.taskId).map((t) => t.taskId)
    )
    const deleted = [...originalTitles.current.keys()].filter(
      (id) => !currentTaskIds.has(id)
    )

    if (updated.length === 0 && created.length === 0 && deleted.length === 0) {
      onOpenChange(false)
      return
    }
    const ok = await onCommit({ updated, created, deleted })
    if (ok) onOpenChange(false)
  }

  return (
    <TaskDecomposeDialog
      open={open}
      onOpenChange={onOpenChange}
      goalTitle={goalTitle}
      description={description}
      onDescriptionChange={setDescription}
      tasks={tasks}
      onTasksChange={setTasks}
      onToggleSelect={toggleSelect}
      phase={phase}
      busy={busy}
      error={error}
      onGenerate={handleGenerate}
      onConfirm={handleConfirm}
      onOpenAiSettings={() => useUiStore.getState().openSettings("ai")}
    />
  )
}
