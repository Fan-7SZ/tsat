import { Link } from "react-router"

import type { TagDefinition } from "@/domain/entities/TagDefinition"
import type { GoalID } from "@/domain/value-objects/types"
import { cn } from "@/lib/utils"
import { Item, ItemContent } from "@/components/ui/item"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { TagPopoverEditor } from "@/components/goal/TagPopoverEditor"
import { useLanguage } from "@/components/shared/language-provider"
import { RowMenuButton } from "@/components/shared/row-context-menu"
import { useHasRowContextMenu } from "@/components/shared/row-context-menu-context"

interface GoalItemProps {
  title: string
  tasksCount: [number, number]
  className?: string
  id: GoalID
  tagMeta?: TagDefinition
  isFocused?: boolean
  dueLabel?: string
  leading?: React.ReactNode
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
  /** Forwarded to the row container (the element the context menu binds to). */
  ref?: React.Ref<HTMLDivElement>
  /** E2E anchor; flows to the row container via `...rest`. */
  "data-testid"?: string
}

export function GoalItem({
  title,
  tasksCount,
  className,
  id,
  tagMeta,
  isFocused,
  dueLabel,
  leading,
  onClick,
  ref,
  ...rest
}: GoalItemProps) {
  const markerColor = tagMeta?.color ?? "var(--border)"
  const { t } = useLanguage()
  const hasContextMenu = useHasRowContextMenu()

  return (
    <div className="relative" ref={ref} {...rest}>
      <Link
        to={`/goals/${id}`}
        className="block no-underline"
        onClick={onClick}
      >
        <Item
          variant="outline"
          size="sm"
          className={cn(
            "relative cursor-pointer hover:bg-accent",
            hasContextMenu ? "pr-14" : "pr-5",
            className
          )}
        >
          <ItemContent>
            <div className="flex items-center gap-3">
              {leading}
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="heading-3 truncate">{title}</div>
                    {(isFocused !== undefined || dueLabel) && (
                      <div className="flex items-center gap-2">
                        {isFocused !== undefined && (
                          <Badge
                            variant={isFocused ? "default" : "outline"}
                            size="lg"
                          >
                            {isFocused ? t.status.focused : t.status.unfocused}
                          </Badge>
                        )}
                        {dueLabel && (
                          <Badge variant="destructive" size="lg">
                            {t.common.due} {dueLabel}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <TasksCount
                  completed={tasksCount[0]}
                  total={tasksCount[1]}
                  className="w-full sm:w-[clamp(180px,50%,420px)] sm:shrink-0"
                />
              </div>
            </div>
          </ItemContent>
        </Item>
      </Link>
      {hasContextMenu && (
        // Sibling of the anchor (an anchor may not nest a button), clear of the
        // tag marker strip pinned at right-0.
        <div className="absolute top-1/2 right-6 -translate-y-1/2">
          <RowMenuButton />
        </div>
      )}
      <TagPopoverEditor
        goalId={id}
        tagMeta={tagMeta}
        align="end"
        trigger={
          <button
            type="button"
            aria-label="Edit goal tag"
            className="absolute inset-y-0 right-0 flex w-7 cursor-pointer items-center justify-end pr-1 transition-opacity hover:opacity-85"
          >
            <span
              className="h-[68%] w-1 rounded-full"
              style={{ backgroundColor: markerColor }}
            />
          </button>
        }
      />
    </div>
  )
}

function TasksCount({
  completed,
  total,
  className,
}: {
  completed: number
  total: number
  className?: string
}) {
  // Over-completion can push the ratio past 1 — the display caps at 100%.
  const progress =
    total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0

  return (
    <div
      className={cn(
        "paragraph-large flex flex-col gap-0 p-0 sm:w-full md:max-w-60",
        className
      )}
    >
      <div className="flex items-center">
        Tasks: {completed}/{total}
        <div className="paragraph-large-bold ml-auto">{progress}%</div>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  )
}
