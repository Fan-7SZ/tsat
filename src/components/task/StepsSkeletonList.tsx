import { Skeleton } from "@/components/ui/skeleton"
import { Item, ItemActions, ItemContent } from "@/components/ui/item"
import { cn } from "@/lib/utils"

// Varied widths so the placeholder rows read as distinct steps.
const WIDTHS = ["w-3/5", "w-4/5", "w-2/3", "w-3/4", "w-1/2", "w-5/6"]

export interface StepsSkeletonListProps {
  /** How many placeholder rows to show (the AI's decided step count). */
  count?: number
  className?: string
}

/**
 * Placeholder rows shown in place of the step list while AI step completion
 * runs. Built from the same <Item> primitives as <StepsItem> — an ItemActions
 * slot stands in for the drag/remove buttons — so the row height matches
 * automatically and nothing shifts when the real steps resolve.
 */
export function StepsSkeletonList({
  count = 3,
  className,
}: StepsSkeletonListProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)} aria-hidden>
      {Array.from({ length: Math.max(count, 1) }).map((_, i) => (
        <Item key={i} variant="outline">
          <ItemContent>
            <Skeleton className={cn("h-3.5", WIDTHS[i % WIDTHS.length])} />
          </ItemContent>
          <ItemActions>
            <Skeleton className="size-6 rounded-md" />
          </ItemActions>
        </Item>
      ))}
    </div>
  )
}
