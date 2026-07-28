import { createContext, useContext } from "react"

/**
 * True for anything rendered inside a row-level context menu (task, goal, …).
 * A right-click is not discoverable and is impossible on touch, so a row that
 * HAS such a menu also shows a visible "⋮" affordance — but only rows actually
 * wrapped by one, which is exactly what this context reports.
 *
 * Kept out of the component file so Fast Refresh keeps working there (a module
 * exporting both components and plain values loses it).
 */
export const HasRowContextMenu = createContext(false)

export function useHasRowContextMenu(): boolean {
  return useContext(HasRowContextMenu)
}
