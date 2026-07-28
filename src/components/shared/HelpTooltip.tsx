import { CircleHelp } from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface HelpTooltipProps {
  /** Static explanation shown on hover / focus. */
  content: string
  /** Accessible label for the trigger button. */
  label: string
  className?: string
}

/**
 * A small `CircleHelp` icon button that reveals a static explanation in a Radix
 * tooltip on hover / keyboard focus. Placed next to a field label to keep the
 * "what is this" copy out of the always-visible layout.
 */
export function HelpTooltip({ content, label, className }: HelpTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className={cn(
              "inline-flex items-center justify-center text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
              className
            )}
          >
            <CircleHelp className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8} className="max-w-80">
          <p className="paragraph-small">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
