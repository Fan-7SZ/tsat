import { Sparkles } from "lucide-react"

import { useLanguage } from "@/components/shared/language-provider"
import { AiDependencyButton } from "@/components/flow/AiDependencyButton"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Field, FieldDescription } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"

// ── Public types ──────────────────────────────────────────

/** idle = ready; optimizing = an AI pass is running against the live graph. */
export type DependencyAssistPhase = "idle" | "optimizing"

/** network = connection/transport failure; api = provider/config/auth failure. */
export type DependencyErrorKind = "network" | "api"

export interface DependencyAssistPopoverProps {
  /** Controlled open state (optional; uncontrolled if omitted). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  description: string
  onDescriptionChange: (value: string) => void
  phase?: DependencyAssistPhase
  error?: DependencyErrorKind | null
  /** Run the optimization against the FlowPanel's current graph. */
  onGenerate: () => void
  onOpenAiSettings?: () => void
  /** Disable the trigger (e.g. fewer than two tasks). */
  disabled?: boolean
}

/**
 * Button-summoned popover holding just the instruction field. The dependency
 * graph itself stays live in the FlowPanel; running an optimization mutates that
 * graph in place, so there's no embedded graph or draft here.
 */
export function DependencyAssistPopover({
  open,
  onOpenChange,
  description,
  onDescriptionChange,
  phase = "idle",
  error = null,
  onGenerate,
  onOpenAiSettings,
  disabled,
}: DependencyAssistPopoverProps) {
  const { t } = useLanguage()
  const busy = phase === "optimizing"

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <AiDependencyButton disabled={disabled} />
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">{t.ai.dependency.title}</p>
          <p className="text-xs text-muted-foreground">
            {t.ai.dependency.subtitle}
          </p>
        </div>

        <Field data-invalid={error ? true : undefined}>
          <InputGroup aria-invalid={error ? true : undefined}>
            <InputGroupInput
              value={description}
              placeholder={t.ai.dependency.placeholder}
              disabled={busy}
              onChange={(e) => onDescriptionChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy) onGenerate()
              }}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                variant="default"
                disabled={busy}
                onClick={onGenerate}
                className="text-[0.625rem]"
              >
                {busy ? <Spinner className="size-3" /> : <Sparkles />}
                {t.ai.dependency.generate}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {error && (
            <FieldDescription className="flex flex-wrap items-center gap-1 text-destructive">
              {error === "network" ? t.ai.errorNetwork : t.ai.errorApi}
              {onOpenAiSettings && (
                <button
                  type="button"
                  onClick={onOpenAiSettings}
                  className="font-medium text-destructive underline underline-offset-4 hover:opacity-80"
                >
                  {t.ai.goSettings}
                </button>
              )}
            </FieldDescription>
          )}
        </Field>
      </PopoverContent>
    </Popover>
  )
}
