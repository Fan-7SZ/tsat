import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
interface PageHeaderProps {
  children: React.ReactNode
  className?: string
  showSidebarTrigger?: boolean
}

export function PageHeader({ children, className }: PageHeaderProps) {
  //   const { state } = useSidebar()
  //   if (state === "collapsed") {
  //     trigger = <SidebarTrigger size="icon-lg" />
  //   } else {
  //     trigger = null
  //   }
  const isMobile = useIsMobile()
  return (
    <div
      className={cn(
        // sticky so it stays pinned to the top of the scrolling SidebarInset
        // (notably on mobile, where the page content overflows and the inset
        // scrolls). On desktop the inset doesn't scroll, so this is a no-op.
        "sticky top-0 z-20 flex h-13 items-center gap-2 border-b bg-sidebar py-2",
        className
      )}
    >
      {/* {trigger} */}
      {isMobile && <SidebarTrigger className="ml-2" size="icon-lg" />}
      {children}
    </div>
  )
}
