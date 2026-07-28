import { Check, Circle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/shared/language-provider"
import type { TaskCompletionCategory } from "@/utils/task-classify"
import { STATUS_TONE } from "@/utils/status-tone"

export interface TaskCompletionBadgeProps {
  category: TaskCompletionCategory
  completedCount: number
  total: number
}

/**
 * Compact, presentational completion indicator for the task detail header.
 * `single` tasks read as a binary completed / in-progress state; `multi` /
 * `repeat` / `trigger` tasks additionally surface the `completedCount / total`
 * ratio. Driven entirely by props — no store / DB access.
 */
export function TaskCompletionBadge({
  category,
  completedCount,
  total,
}: TaskCompletionBadgeProps) {
  const { t } = useLanguage()
  const finished = completedCount >= total
  const showCount = category !== "single"

  return (
    <Badge
      size="lg"
      variant="outline"
      className={cn(finished ? STATUS_TONE.green : "text-muted-foreground")}
    >
      {finished ? (
        <Check data-icon="inline-start" />
      ) : (
        <Circle data-icon="inline-start" />
      )}
      {finished ? t.status.completed : t.status.incomplete}
      {/* The ratio is supporting detail, so it stays muted rather than taking
          the badge's accent colour. */}
      {showCount && (
        <span className="text-muted-foreground">
          {completedCount} / {total}
        </span>
      )}
    </Badge>
  )
}
