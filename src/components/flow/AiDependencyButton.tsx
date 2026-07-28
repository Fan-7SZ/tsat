import { Sparkles } from "lucide-react"

import { useLanguage } from "@/components/shared/language-provider"
import { Button } from "@/components/ui/button"

/**
 * Entry point that summons the dependency-optimize popover. Sized to sit in the
 * FlowPanel top-right toolbar next to Undo/Save (sm / outline). Spreads props so
 * it can be a Popover/Tooltip `asChild` trigger.
 */
export function AiDependencyButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { t } = useLanguage()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      {...props}
    >
      <Sparkles />
      {t.ai.dependency.button}
    </Button>
  )
}
