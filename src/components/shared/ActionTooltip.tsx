import * as React from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * Wraps a single interactive element (button, checkbox, …) with a
 * top-positioned tooltip label. The child must forward refs/props, so pass a
 * single element and rely on `asChild`.
 */
export function ActionTooltip({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          <p className="paragraph-small">{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
