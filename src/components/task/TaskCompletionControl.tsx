import { Fragment, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { STATUS_TONE, STATUS_TONE_HOVER } from "@/utils/status-tone"

export interface CompletionActionItem {
  key: string
  label: string
  icon?: ReactNode
  variant?: "default" | "destructive"
  /** Renders the item greyed-out and non-interactive (onSelect is suppressed). */
  disabled?: boolean
  /** Optional wrapper, e.g. to host a hovercard explaining a disabled item. */
  wrap?: (node: ReactNode) => ReactNode
  onSelect: () => void
}

export interface CompletionPrimaryAction extends CompletionActionItem {
  /** "done" paints the main button green (it now reads as "completed"). */
  tone?: "done" | "neutral"
}

export interface TaskCompletionControlProps {
  primary: CompletionPrimaryAction
  /** Dropdown items; when empty/undefined only the main button renders. */
  secondary?: CompletionActionItem[]
  disabled?: boolean
  /** Accessible label for the dropdown trigger. */
  menuLabel?: string
}

/**
 * Presentational completion control placed left of the delete button in the
 * task detail header. A status-aware primary button plus an optional dropdown
 * of secondary actions. Entirely driven by props — no store / command / DB
 * access; callers compute the action model from the task + its runtime state.
 */
export function TaskCompletionControl({
  primary,
  secondary = [],
  disabled = false,
  menuLabel,
}: TaskCompletionControlProps) {
  const mainButton = (
    <Button
      data-testid={`task-primary-${primary.key}`}
      variant="outline"
      disabled={disabled || primary.disabled}
      className={cn(
        primary.tone === "done" && [STATUS_TONE.green, STATUS_TONE_HOVER.green]
      )}
      onClick={primary.disabled ? undefined : primary.onSelect}
    >
      {primary.icon && <span data-icon="inline-start">{primary.icon}</span>}
      {primary.label}
    </Button>
  )
  const mainNode = primary.wrap ? primary.wrap(mainButton) : mainButton

  if (secondary.length === 0) {
    return mainNode
  }

  return (
    <ButtonGroup>
      {mainNode}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={disabled} aria-label={menuLabel}>
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {secondary.map((item) => {
            const menuItem = (
              <DropdownMenuItem
                variant={
                  item.variant === "destructive" ? "destructive" : "default"
                }
                disabled={item.disabled}
                onSelect={
                  item.disabled ? (e) => e.preventDefault() : item.onSelect
                }
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            )
            return (
              <Fragment key={item.key}>
                {item.wrap ? item.wrap(menuItem) : menuItem}
              </Fragment>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  )
}
