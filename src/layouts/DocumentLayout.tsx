import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronRight, Menu } from "lucide-react"
import { useEffect, useState } from "react"
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useLanguage } from "@/components/shared/language-provider"
import { Outlet, useNavigate, useLocation } from "react-router"

/**
 * Restartable highlight pulse on a scrolled-to element, shared by hash jumps
 * and the "On this page" rail: drop the class, force a reflow, re-add, and
 * clean up on animationend so the next trigger replays it.
 */
function flashElement(el: Element) {
  el.classList.remove("doc-hash-flash")
  void (el as HTMLElement).offsetWidth
  el.classList.add("doc-hash-flash")
  el.addEventListener(
    "animationend",
    () => el.classList.remove("doc-hash-flash"),
    { once: true }
  )
}

function useDocHashScroll() {
  const { pathname, hash, key } = useLocation()
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0 })
      return
    }
    const id = decodeURIComponent(hash.slice(1))
    let cancelled = false
    let flashed = false
    const scrollToTarget = () => {
      if (cancelled) return
      const el = document.getElementById(id)
      if (!el) return
      el.scrollIntoView({ behavior: "auto", block: "start" })
      if (!flashed) {
        flashed = true
        flashElement(el)
      }
    }
    const raf = requestAnimationFrame(scrollToTarget)
    const timers = [120, 350, 700].map((ms) => setTimeout(scrollToTarget, ms))
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout)
    }
  }, [pathname, hash, key])
}

export function DocumentLayout() {
  const [open, setOpen] = useState(false)
  useDocHashScroll()
  return (
    <div className="flex min-h-screen flex-col">
      <Header onMenuClick={() => setOpen(true)} />
      <div className="flex flex-1">
        <DocsSidebar showSidebar={open} setOpen={setOpen} />
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-4xl">
            <Outlet />
          </div>
        </main>
        {/* Same width as the left sidebar so the article stays centered. */}
        <OnThisPageAside />
      </div>
    </div>
  )
}

/**
 * "On this page" rail: lists the current page's section titles (the rendered
 * `main h2` elements) and scrolls to one on click. Re-scanned per route; the
 * aside is always mounted (even when empty) so the article column — flanked by
 * two equal-width rails — keeps its viewport-centered position.
 */
function OnThisPageAside() {
  const { t } = useLanguage()
  const { pathname } = useLocation()
  const [titles, setTitles] = useState<string[]>([])

  useEffect(() => {
    // One frame so the destination page has rendered its sections.
    const raf = requestAnimationFrame(() => {
      setTitles(
        Array.from(document.querySelectorAll("main h2")).map(
          (el) => el.textContent ?? ""
        )
      )
    })
    return () => cancelAnimationFrame(raf)
  }, [pathname])

  const scrollToSection = (index: number) => {
    const heading = document.querySelectorAll("main h2")[index]
    if (!heading) return
    heading.scrollIntoView({ behavior: "smooth", block: "start" })
    // Pulse the whole section (the title's container), matching hash jumps.
    flashElement(heading.parentElement ?? heading)
  }

  return (
    <aside className="sticky top-11 hidden h-[calc(100vh-2.75rem)] w-64 self-start p-4 sm:block">
      {titles.length > 0 && (
        <ScrollArea className="h-full">
          <span className="caption text-muted-foreground">
            {t.doc.onThisPage}
          </span>
          <ul className="mt-3 flex flex-col gap-2">
            {titles.map((title, index) => (
              <li key={`${title}-${index}`}>
                <button
                  type="button"
                  className="paragraph-small inline-flex items-center gap-1 text-left text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => scrollToSection(index)}
                >
                  {title}
                  <ChevronRight className="size-4 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </aside>
  )
}

function DocsSidebar({
  showSidebar,
  setOpen,
}: {
  showSidebar?: boolean
  setOpen?: (open: boolean) => void
}) {
  return (
    <>
      <aside className="sticky top-11 hidden h-[calc(100vh-2.75rem)] w-64 self-start p-4 sm:block">
        <ScrollArea className="h-full">
          <AsideSheetContent />
        </ScrollArea>
      </aside>
      <div className="sm:hidden">
        <Sheet open={showSidebar} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-[85vw] p-6">
            <ScrollArea className="h-full">
              <AsideSheetContent />
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { t } = useLanguage()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-40 flex items-center gap-2 bg-background px-4 py-2">
      <Button variant="ghost" className="sm:hidden" onClick={onMenuClick}>
        <Menu className="size-5" />
        Menu
      </Button>
      <Button
        variant="outline"
        className="ml-auto"
        onClick={() => navigate("/")}
      >
        {t.doc.home}
      </Button>
    </header>
  )
}
function docItemKey(item: { to: string; hash?: string }): string {
  return item.hash ? `${item.to}#${item.hash}` : item.to
}

function AsideSheetContent() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const relativePath = location.pathname.replace(/^\/doc\/?/, "")
  const currentHash = location.hash.replace(/^#/, "")
  const groups = [
    {
      label: t.doc.groups.concepts,
      items: [
        { label: t.doc.concepts.core, to: "concepts/core" },
        {
          label: t.doc.concepts.estimatedOccurrences,
          to: "concepts/estimated-occurrences",
        },
        {
          label: t.doc.concepts.trigger,
          to: "concepts/trigger-and-repeat-rule",
          hash: "trigger",
        },
        {
          label: t.doc.concepts.repeatRule,
          to: "concepts/trigger-and-repeat-rule",
          hash: "repeat-rule",
        },
        {
          label: t.doc.concepts.repeatRuleVsTrigger,
          to: "concepts/trigger-and-repeat-rule",
          hash: "vs",
        },
        { label: t.doc.concepts.dailyFocus, to: "concepts/daily-focus" },
      ],
    },
    {
      label: t.doc.groups.guides,
      items: [
        { label: t.doc.guides.quickStart, to: "guides/quick-start" },
        { label: t.doc.guides.setTrigger, to: "guides/set-a-trigger" },
        { label: t.doc.guides.setRepeatRule, to: "guides/set-a-repeat-rule" },
        { label: t.doc.guides.syncSetup, to: "guides/sync-setup" },
        {
          label: t.doc.guides.aiEstimationSetup,
          to: "guides/ai-setup",
        },
      ],
    },
  ]

  // Derive the active item from the URL so the default route (and back/forward
  // navigation) highlights the right button — not just explicit clicks. When a
  // page's items are all hash anchors and the URL carries no hash, fall back to
  // the first item on that page.
  const targetKey = currentHash
    ? `${relativePath}#${currentHash}`
    : relativePath
  const items = groups.flatMap((group) => group.items)
  const firstOnPage = items.find((item) => item.to === relativePath)
  const activeKey = items.some((item) => docItemKey(item) === targetKey)
    ? targetKey
    : firstOnPage
      ? docItemKey(firstOnPage)
      : targetKey

  return (
    <SidebarContent className="gap-1">
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel className="group/label">
            <span>{group.label}</span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const itemKey = docItemKey(item)
                return (
                  <SidebarMenuItem key={itemKey}>
                    <Button
                      variant={activeKey === itemKey ? "secondary" : "ghost"}
                      className="justify-start"
                      onClick={() => {
                        if (item.hash) {
                          navigate(`${item.to}#${item.hash}`)
                        } else {
                          navigate(item.to)
                        }
                      }}
                    >
                      {item.label}
                    </Button>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </SidebarContent>
  )
}
