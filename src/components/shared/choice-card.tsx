import * as React from "react"

import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export interface ChoiceCardProps {
  /** Drives the Switch id + the FieldLabel association. Must be unique per card. */
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  title: React.ReactNode
  /** Short explanatory text shown directly as the card description (no tooltip). */
  description?: React.ReactNode
  switchAriaLabel?: string
  /** Config form, revealed inside the card (below a divider) when `checked`. */
  children?: React.ReactNode
  className?: string
}

/**
 * shadcn "choice card": a {@link Card} that highlights (accent fill + ring) when
 * its switch is on. The header is a horizontal {@link Field} — a {@link FieldLabel}
 * (the title, which labels and toggles the switch) over a {@link FieldDescription},
 * with the {@link Switch} on the right. When `checked`, the config `children`
 * expand inside the card as a second {@link CardContent} below a divider.
 *
 * Built entirely from the Card/Field primitives — the highlight keys off the inner
 * Switch's `data-checked`, so no extra state is needed.
 */
export function ChoiceCard({
  id,
  checked,
  onCheckedChange,
  disabled = false,
  title,
  description,
  switchAriaLabel,
  children,
  className,
}: ChoiceCardProps) {
  return (
    <Card
      data-disabled={disabled || undefined}
      className={cn(
        "transition-colors",
        "has-data-checked:bg-accent has-data-checked:ring-ring",
        "data-disabled:pointer-events-none data-disabled:opacity-60",
        className
      )}
    >
      <CardContent>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor={id}>{title}</FieldLabel>
            {description && <FieldDescription>{description}</FieldDescription>}
          </FieldContent>
          <Switch
            id={id}
            checked={checked}
            disabled={disabled}
            onCheckedChange={onCheckedChange}
            aria-label={switchAriaLabel}
          />
        </Field>
      </CardContent>
      {checked && children && (
        <CardContent>
          {/* Separator lives inside the px-4 CardContent, so its w-full spans
              the content width — an inset divider, not edge-to-edge. */}
          <Separator className="mb-4" />
          {children}
        </CardContent>
      )}
    </Card>
  )
}
