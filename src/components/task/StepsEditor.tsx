import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { StepsItem } from "@/components/task/StepsItem"
import { cn } from "@/lib/utils"
import type { Steps } from "@/domain/value-objects/types"
import { DragDropProvider } from "@dnd-kit/react"
import { isSortable } from "@dnd-kit/react/sortable"

// Pure positional move; reused for drag-reorder without pulling @dnd-kit/helpers.
function arrayMove<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export interface StepsEditorProps {
  steps: Steps
  stepInput: string
  onStepInputChange: (value: string) => void
  onAddStep: () => void
  /** Provide either to enable edit mode; omit both for a read-only list. */
  onUpdateStep?: (index: number, value: string) => void
  onRemoveStep?: (index: number) => void
  /** When provided (and not disabled), the list becomes drag-sortable. */
  onReorderSteps?: (next: Steps) => void

  disabled?: boolean
  placeholder: string
  addStepAriaLabel?: string
  /** When set, wrap the list in a ScrollArea with this className. */
  scrollClassName?: string
  /**
   * Keep the (scroll) list region mounted even with zero steps, so its height
   * stays fixed as the count changes. Requires scrollClassName to have effect.
   */
  reserveScroll?: boolean
  /** Render the add row above the list instead of below it. */
  addRowFirst?: boolean
}

/**
 * Presentational, fully-controlled steps editor shared by the task and AI
 * draft panels. Renders only the list and the add row; the section heading,
 * wrapper, and the actual add/update/remove actions stay in the caller.
 * Omitting both onUpdateStep and onRemoveStep (or passing disabled) yields a
 * read-only list.
 */
export function StepsEditor({
  steps,
  stepInput,
  onStepInputChange,
  onAddStep,
  onUpdateStep,
  onRemoveStep,
  onReorderSteps,
  disabled = false,
  placeholder,
  addStepAriaLabel,
  scrollClassName,
  reserveScroll = false,
  addRowFirst = false,
}: StepsEditorProps) {
  const list = (
    <DragDropProvider
      onDragEnd={(e) => {
        if (disabled || !onReorderSteps || e.canceled) return
        const { source } = e.operation
        if (!isSortable(source)) return
        const { initialIndex: from, index: to } = source
        if (from !== to) onReorderSteps(arrayMove(steps, from, to))
      }}
    >
      <div className={cn("flex flex-col gap-1", scrollClassName && "pr-2")}>
        {steps.map((step, index) => (
          <StepsItem
            key={step.id}
            id={step.id}
            index={index}
            title={step.title}
            disabled={disabled}
            onTitleChange={
              disabled || !onUpdateStep
                ? undefined
                : (value) => onUpdateStep(index, value)
            }
            onRemove={
              disabled || !onRemoveStep ? undefined : () => onRemoveStep(index)
            }
          />
        ))}
      </div>
    </DragDropProvider>
  )

  const listNode = (steps.length > 0 || reserveScroll) && (
    <>
      {scrollClassName ? (
        <ScrollArea className={scrollClassName}>{list}</ScrollArea>
      ) : (
        list
      )}
    </>
  )

  const addRow = (
    <div className="flex gap-2">
      <Input
        value={stepInput}
        onChange={(e) => onStepInputChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1"
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            onAddStep()
          }
        }}
      />
      <Button
        variant="outline"
        size="icon"
        onClick={onAddStep}
        disabled={!stepInput.trim() || disabled}
        aria-label={addStepAriaLabel}
      >
        <Plus />
      </Button>
    </div>
  )

  return (
    <>
      {addRowFirst ? (
        <>
          {addRow}
          {listNode}
        </>
      ) : (
        <>
          {listNode}
          {addRow}
        </>
      )}
    </>
  )
}
