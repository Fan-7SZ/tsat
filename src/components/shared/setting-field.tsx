import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Composable "label + help text + control" group shared by the settings dialogs
 * and sync panels. Wraps the project's typography presets so every setting-style
 * field stays visually consistent (title spacing, muted description, gap) without
 * re-deriving classes at each call site.
 *
 * @example
 * <SettingField>
 *   <SettingFieldTitle>{t.settings.language}</SettingFieldTitle>
 *   <SettingFieldDescription>{t.settings.languageHelp}</SettingFieldDescription>
 *   <Select ... />
 * </SettingField>
 */
function SettingField({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="setting-field"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  )
}

function SettingFieldTitle({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="setting-field-title"
      className={cn("paragraph-small-medium", className)}
      {...props}
    />
  )
}

const settingFieldDescriptionVariants = cva("paragraph-mini", {
  variants: {
    variant: {
      muted: "text-muted-foreground",
      destructive: "text-destructive",
    },
  },
  defaultVariants: {
    variant: "muted",
  },
})

/**
 * Help/secondary text under a {@link SettingFieldTitle}. `variant="destructive"`
 * turns it into an inline error line (e.g. an authorization or unlock failure).
 */
function SettingFieldDescription({
  className,
  variant,
  ...props
}: React.ComponentProps<"p"> &
  VariantProps<typeof settingFieldDescriptionVariants>) {
  return (
    <p
      data-slot="setting-field-description"
      className={cn(settingFieldDescriptionVariants({ variant }), className)}
      {...props}
    />
  )
}

/**
 * Inline validation/error line under a field's control. Larger than a
 * destructive description (14px vs 12px) to match form-field error emphasis.
 */
function SettingFieldError({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="setting-field-error"
      className={cn("paragraph-small text-destructive", className)}
      {...props}
    />
  )
}

export {
  SettingField,
  SettingFieldTitle,
  SettingFieldDescription,
  SettingFieldError,
}
