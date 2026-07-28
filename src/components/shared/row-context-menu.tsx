import { EllipsisVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/components/shared/language-provider"
import { HasRowContextMenu } from "./row-context-menu-context"

export function RowContextMenuProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <HasRowContextMenu.Provider value={true}>
      {children}
    </HasRowContextMenu.Provider>
  )
}

/**
 * Re-dispatch a `contextmenu` event from the clicked control. It bubbles to the
 * ContextMenuTrigger wrapping the row and opens the very same menu a right-click
 * would — one menu definition, not two that can drift.
 *
 * Two things the row must uphold for this to work:
 *  - the trigger binds to the row CONTAINER (not to an inner anchor), so the
 *    dispatched event reaches it by plain bubbling;
 *  - an anchor may not nest a button, so the control is the anchor's sibling.
 */
// The opener is this component's public interaction contract; splitting it
// off would separate the dispatch from the trigger it targets.
// eslint-disable-next-line react-refresh/only-export-components
export function openRowContextMenu(
  event: React.MouseEvent<HTMLElement>
): void {
  // Keep the click itself from navigating / toggling the row.
  event.preventDefault()
  event.stopPropagation()
  const target = event.currentTarget
  const rect = target.getBoundingClientRect()
  // After the click settles: the menu's dismiss layer listens on the document,
  // so a menu opened *during* this click would be closed again by it.
  setTimeout(() => {
    target.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: Math.round(rect.left + rect.width / 2),
        clientY: Math.round(rect.bottom),
      })
    )
  }, 0)
}

/** Visible "⋮" affordance for a row's context menu. */
export function RowMenuButton({
  className,
  size = "icon",
}: {
  className?: string
  size?: "icon" | "icon-sm"
}) {
  const { t } = useLanguage()
  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      aria-label={t.actions.moreActions}
      className={className ?? "shrink-0 text-muted-foreground"}
      onClick={openRowContextMenu}
    >
      <EllipsisVertical />
    </Button>
  )
}
