import { Sparkles } from "lucide-react"

import { useLanguage } from "@/components/shared/language-provider"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

/** idle = ready; counting = deciding how many steps; filling = writing them. */
export type StepsAutofillPhase = "idle" | "counting" | "filling"

export interface AiStepsButtonProps {
  phase?: StepsAutofillPhase
  /** Disable independently of the busy state (e.g. no task title yet). */
  disabled?: boolean
  onClick?: () => void
  className?: string
}

/**
 * Trigger for AI step completion, sized for a steps section heading. While the
 * request runs it disables itself and swaps its icon for a spinner; the caller
 * replaces the step list with <StepsSkeletonList> for the same phases.
 */
export function AiStepsButton({
  phase = "idle",
  disabled,
  onClick,
  className,
}: AiStepsButtonProps) {
  const { t } = useLanguage()
  const busy = phase !== "idle"

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || busy}
      onClick={onClick}
      className={className}
    >
      {busy ? <Spinner className="size-3" /> : <Sparkles />}
      {phase === "counting"
        ? t.ai.steps.counting
        : phase === "filling"
          ? t.ai.steps.filling
          : t.ai.steps.idle}
    </Button>
  )
}
