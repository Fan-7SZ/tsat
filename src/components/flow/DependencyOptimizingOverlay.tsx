import { useLanguage } from "@/components/shared/language-provider"
import { Spinner } from "@/components/ui/spinner"

/**
 * Mask shown over the FlowPanel while an AI dependency optimization runs. The
 * parent (FlowPanel container / story flow box) must be `relative` and render
 * this only while busy.
 */
export function DependencyOptimizingOverlay() {
  const { t } = useLanguage()

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/60 text-xs text-muted-foreground supports-backdrop-filter:backdrop-blur-xs">
      <Spinner className="size-4" />
      {t.ai.dependency.optimizing}
    </div>
  )
}
