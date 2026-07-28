import * as React from "react"
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function ScrollArea({
  className,
  children,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  /** Which axes may scroll. Defaults to "vertical" — the app has no horizontal
   *  scrollers, and vertical mode also pins the content wrapper to block (see
   *  below) so long rows truncate instead of spilling a horizontal scrollbar.
   *  Use "horizontal"/"both" only for genuinely wide content. */
  orientation?: "vertical" | "horizontal" | "both"
}) {
  const vertical = orientation !== "horizontal"
  const horizontal = orientation !== "vertical"
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className={cn(
          // The Viewport is the actual scroll container, but its `size-full`
          // (height:100%) is indefinite when the root only sets a `max-h-*`, so
          // it collapses to content height and never scrolls — the root just
          // clips. Inheriting the root's max-height caps the Viewport itself so
          // any `max-h-*` on the root scrolls as intended; roots with a definite
          // height have max-height:none, so this is a no-op for them.
          "size-full max-h-[inherit] rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1",
          // Vertical-only: force Radix's inner content wrapper off its default
          // `display:table` (which shrink-wraps to content width, breaking rows'
          // `truncate` and spilling a horizontal scrollbar) back to block, so it
          // stays capped at the viewport width.
          !horizontal && "[&>div]:block!"
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {vertical && <ScrollBar />}
      {horizontal && <ScrollBar orientation="horizontal" />}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }
