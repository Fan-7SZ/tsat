import React from "react"
import { Link } from "react-router"
import {
  ChevronRight,
  CircleCheck,
  GraduationCap,
  Info,
  Lightbulb,
  OctagonAlert,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Separator } from "../ui/separator"
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from "@/components/ui/item"
export function DocGroup({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn("flex flex-col gap-2", className)}>{children}</div>
}
export function DocPageHeader({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-4 pt-5 pb-15", className)}>
      {children}
    </div>
  )
}
export function DocPageTitle({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <h1 className={cn("heading-2 px-4", className)}>{children}</h1>
}
export function DocPageDescription({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  // A <div> (not <p>) so the Separator — which renders a <div> — is legal
  // markup; keeping both inside one padded box preserves the original inset and
  // spacing (it stays a single flex child of DocPageHeader).
  return (
    <div
      className={cn(
        "paragraph-large w-full px-4 text-muted-foreground",
        className
      )}
    >
      {children}
      <Separator className="my-1" />
    </div>
  )
}
export function DocSectionTitle({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  // scroll-mt clears the sticky doc header when the "On this page" rail (or a
  // hash link) scrolls a section title into view.
  return <h2 className={cn("heading-3 scroll-mt-20", className)}>{children}</h2>
}
export function DocSectionContent({
  children,
  className,
  id,
}: {
  children: React.ReactNode
  className?: string
  /** When set, the section becomes a hash-anchor target (e.g. #trigger). */
  id?: string
}) {
  return (
    <div
      id={id}
      className={cn(
        "paragraph-regular flex flex-col gap-2 px-4 py-5",
        // Clear the sticky doc header when scrolled to via a hash link.
        id && "scroll-mt-20",
        className
      )}
    >
      {children}
    </div>
  )
}

export function DocItem({
  className,
  ...props
}: React.ComponentProps<typeof Item>) {
  return (
    <Item
      variant="outline"
      className={cn("text-base/relaxed", className)}
      {...props}
    />
  )
}
export function DocItemContent({
  className,
  ...props
}: React.ComponentProps<typeof ItemContent>) {
  return <ItemContent className={cn("gap-1.5", className)} {...props} />
}
export function DocItemTitle({
  className,
  ...props
}: React.ComponentProps<typeof ItemTitle>) {
  // `line-clamp-none`: a doc heading may wrap; the primitive truncates to one line.
  return (
    <ItemTitle
      className={cn(
        "line-clamp-none flex text-lg/relaxed font-medium",
        className
      )}
      {...props}
    />
  )
}
export function DocItemDescription({
  className,
  ...props
}: React.ComponentProps<typeof ItemDescription>) {
  return (
    <ItemDescription
      className={cn("line-clamp-none text-base/relaxed", className)}
      {...props}
    />
  )
}
export function DocSectionImage({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} className="my-2 w-full rounded-lg border" />
}

/**
 * Semantic callout box. `tone` picks both the soft accent colour (via the Item
 * variant) and a matching default icon, so every callout of the same meaning
 * reads identically across the docs. Pass `icon` to override the glyph while
 * keeping the tone's colour.
 */
export type DocCalloutTone =
  | "info"
  | "success"
  | "warning"
  | "tip"
  | "danger"
  | "note"
  /** Tutorial pointer — a callout whose job is to link another doc page. */
  | "learn"

const DOC_CALLOUT_TONE: Record<
  DocCalloutTone,
  {
    variant: React.ComponentProps<typeof Item>["variant"]
    icon: LucideIcon
    iconClassName: string
  }
> = {
  info: {
    variant: "info",
    icon: Info,
    iconClassName: "text-blue-700 dark:text-blue-400",
  },
  success: {
    variant: "success",
    icon: CircleCheck,
    iconClassName: "text-green-700 dark:text-green-400",
  },
  warning: {
    variant: "warning",
    icon: TriangleAlert,
    iconClassName: "text-amber-700 dark:text-amber-400",
  },
  tip: {
    variant: "tip",
    icon: Lightbulb,
    iconClassName: "text-violet-700 dark:text-violet-400",
  },
  danger: {
    variant: "danger",
    icon: OctagonAlert,
    iconClassName: "text-red-700 dark:text-red-400",
  },
  note: {
    variant: "muted",
    icon: Info,
    iconClassName: "text-muted-foreground",
  },
  learn: {
    variant: "info",
    icon: GraduationCap,
    iconClassName: "text-blue-700 dark:text-blue-400",
  },
}

export function DocCallout({
  tone = "info",
  title,
  icon,
  children,
  className,
}: {
  tone?: DocCalloutTone
  title: React.ReactNode
  icon?: LucideIcon
  children?: React.ReactNode
  className?: string
}) {
  const cfg = DOC_CALLOUT_TONE[tone]
  const Icon = icon ?? cfg.icon
  return (
    <DocItem variant={cfg.variant} className={className}>
      <DocItemContent>
        <DocItemTitle>
          <Icon className={cn("size-5 shrink-0", cfg.iconClassName)} />
          {title}
        </DocItemTitle>
        {children == null ? null : (
          <DocItemDescription>{children}</DocItemDescription>
        )}
      </DocItemContent>
    </DocItem>
  )
}

export function DocLinkList({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <ul className={cn("mt-2 flex flex-col gap-4", className)}>{children}</ul>
  )
}
export function DocLinkGroup({
  title,
  children,
  className,
}: {
  title: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <li className={cn("flex flex-col gap-1.5", className)}>
      <span className="paragraph-medium text-muted-foreground">{title}</span>
      <ul className="flex flex-col gap-1">{children}</ul>
    </li>
  )
}
export function DocLink({
  to,
  children,
  className,
}: {
  to: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <li>
      <Link
        to={to}
        className={cn(
          "inline-flex items-center gap-1 underline-offset-4 hover:underline",
          className
        )}
      >
        {children}
        <ChevronRight className="size-4" />
      </Link>
    </li>
  )
}

/**
 * Semantic enumeration inside a section: a real <ul>/<ol> whose items follow
 * the bold-lead pattern — `<li><b>Name</b> — description…</li>`. Use `ordered`
 * for sequential steps so the browser numbers them.
 */
export function DocList({
  ordered = false,
  children,
  className,
}: {
  ordered?: boolean
  children: React.ReactNode
  className?: string
}) {
  const Comp = ordered ? "ol" : "ul"
  return (
    <Comp
      className={cn(
        "flex flex-col gap-2 pl-5 marker:text-muted-foreground",
        ordered ? "list-decimal" : "list-disc",
        className
      )}
    >
      {children}
    </Comp>
  )
}

/** Inline prose link (no list item / chevron) — safe to drop inside a <p>. */
export function DocInlineLink({
  to,
  children,
  className,
}: {
  to: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        "font-medium underline underline-offset-4 hover:text-primary",
        className
      )}
    >
      {children}
    </Link>
  )
}

export function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-lg border bg-muted p-4 text-sm">
      <code>{children}</code>
    </pre>
  )
}
