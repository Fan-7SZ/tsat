import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { useAppNavigation } from "@/hooks/use-app-navigation"
import { cn } from "@/lib/utils"

/**
 * In-app history back/forward button group shared across page headers.
 * Hidden on small screens (matches the original per-page implementation).
 */
export function NavHistoryButtons({ className }: { className?: string }) {
  const { goBack, goForward, canGoBack, canGoForward } = useAppNavigation()
  return (
    <ButtonGroup className={cn("hidden sm:flex", className)}>
      <Button variant="outline" size="lg" disabled={!canGoBack} onClick={goBack}>
        <ChevronLeft />
      </Button>
      <Button
        variant="outline"
        size="lg"
        disabled={!canGoForward}
        onClick={goForward}
      >
        <ChevronRight />
      </Button>
    </ButtonGroup>
  )
}
