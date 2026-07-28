import { GripVertical, Trash } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "../ui/button"
import { Item, ItemTitle } from "../ui/item"
import { cn } from "@/lib/utils"
import { InLineSwitchEditor } from "@/components/shared/InLineSwitchEditor"
import { useLanguage } from "@/components/shared/language-provider"
import { useSortable } from "@dnd-kit/react/sortable"
export function StepsItem({
  title,
  id,
  index,
  className,
  disabled = false,
  onTitleChange,
  onRemove,
}: {
  title: string
  id: string
  index: number
  className?: string
  /** Disables drag-sorting and hides the drag handle. */
  disabled?: boolean
  onTitleChange?: (value: string) => void
  onRemove?: () => void
}) {
  // Transient edit buffer only; the displayed title always comes from props.
  const [draftTitle, setDraftTitle] = useState(title)
  const [isHovered, setIsHovered] = useState(false)
  const { t } = useLanguage()

  useEffect(() => {
    setDraftTitle(title)
  }, [title])

  const commitTitle = () => {
    const trimmed = draftTitle.trim()
    const next = trimmed.length > 0 ? trimmed : title
    setDraftTitle(next)
    if (next !== title) {
      onTitleChange?.(next)
    }
  }

  const cancelEdit = () => {
    setDraftTitle(title)
  }
  const { ref, handleRef } = useSortable({
    id,
    index,
    disabled,
  })

  return (
    <Item
      variant="outline"
      className={cn("cursor-pointer flex-nowrap hover:bg-accent", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      ref={ref}
    >
      <ItemTitle className="min-w-0 flex-1">
        <InLineSwitchEditor
          className="min-w-0"
          view={
            <span className="break-words whitespace-normal">
              {index + 1}. {title}
            </span>
          }
          edit={
            // field-sizing:content keeps the input as wide as its text, so
            // switching to edit mode doesn't grow the box; `size` is the
            // fallback for browsers without it.
            <input
              value={draftTitle}
              size={Math.max(draftTitle.length, 1)}
              onChange={(e) => setDraftTitle(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              className="field-sizing-content max-w-full border-none bg-transparent p-0 ring-0 outline-none focus:ring-0"
              aria-label={t.stepsItem.editStepTitle}
            />
          }
          onStatusChange={(by) => {
            if (by === "doubleClick") {
              setDraftTitle(title)
              return
            }

            if (by === "escape") {
              cancelEdit()
              return
            }

            commitTitle()
          }}
        />
      </ItemTitle>
      <div
        className={cn(
          "ml-auto flex shrink-0 items-center transition-opacity",
          isHovered ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-destructive hover:text-destructive"
          onClick={onRemove}
          aria-label={t.stepsItem.removeStep}
        >
          <Trash />
        </Button>
        {!disabled && (
          <button
            type="button"
            ref={handleRef}
            className="flex size-6 cursor-grab touch-none items-center justify-center text-muted-foreground/50 transition-colors hover:text-muted-foreground"
            aria-label={t.stepsItem.reorderStep}
          >
            <GripVertical className="size-3.5" />
          </button>
        )}
      </div>
    </Item>
  )
}
