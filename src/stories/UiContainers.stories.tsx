import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  BellIcon,
  ChevronsUpDownIcon,
  MoreHorizontalIcon,
  TargetIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Header } from "@/components/ui/header"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

const ITEM_VARIANTS = [
  "default",
  "outline",
  "muted",
  "info",
  "success",
  "warning",
  "tip",
  "danger",
] as const

/**
 * Style gallery for the container family: Card, Tabs, Table, Separator,
 * ScrollArea, Collapsible, Item and Header.
 */
const meta = {
  title: "UI/Containers",
  component: Card,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

/** Card anatomy: header with action, content and footer. */
export const Cards: Story = {
  render: () => (
    <div className="flex items-start gap-6 p-6">
      <Card className="w-72">
        <CardHeader>
          <CardTitle>Reading goal</CardTitle>
          <CardDescription>12 books this year, 4 done.</CardDescription>
          <CardAction>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="More"
            >
              <MoreHorizontalIcon />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Next up: finish chapter 7 of the current book before Sunday.
          </p>
        </CardContent>
        <CardFooter className="gap-2">
          <Button size="sm">Continue</Button>
          <Button size="sm" variant="outline">
            Details
          </Button>
        </CardFooter>
      </Card>

      <Card className="w-72">
        <CardHeader>
          <CardTitle>Minimal card</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Header and content only, no action or footer.
          </p>
        </CardContent>
      </Card>
    </div>
  ),
}

/** Tabs: default and line variants, horizontal and vertical. */
export const TabsGallery: Story = {
  render: () => (
    <div className="flex flex-col gap-8 p-6">
      <Tabs defaultValue="today" className="w-96">
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="all" disabled>
            All
          </TabsTrigger>
        </TabsList>
        <TabsContent value="today">Default variant, first tab.</TabsContent>
        <TabsContent value="week">Week content.</TabsContent>
      </Tabs>

      <Tabs defaultValue="today" className="w-96">
        <TabsList variant="line">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value="today">Line variant, first tab.</TabsContent>
      </Tabs>

      <Tabs defaultValue="general" orientation="vertical" className="w-96">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="sync">Sync</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
        </TabsList>
        <TabsContent value="general">Vertical orientation.</TabsContent>
      </Tabs>
    </div>
  ),
}

/** Table with caption, header, body and footer. */
export const Tables: Story = {
  render: () => (
    <div className="w-120 p-6">
      <Table>
        <TableCaption>Focus minutes for the current week.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Day</TableHead>
            <TableHead>Tasks</TableHead>
            <TableHead className="text-right">Minutes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            ["Monday", "5", "180"],
            ["Tuesday", "3", "95"],
            ["Wednesday", "6", "210"],
          ].map(([day, tasks, minutes]) => (
            <TableRow key={day}>
              <TableCell className="font-medium">{day}</TableCell>
              <TableCell>{tasks}</TableCell>
              <TableCell className="text-right">{minutes}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>Total</TableCell>
            <TableCell className="text-right">485</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  ),
}

/** Separator: horizontal between blocks, vertical between inline items. */
export const Separators: Story = {
  render: () => (
    <div className="w-72 p-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium">Radix Separator</p>
        <p className="text-xs text-muted-foreground">
          Divides content horizontally or vertically.
        </p>
      </div>
      <Separator className="my-4" />
      <div className="flex h-5 items-center gap-4 text-xs">
        <span>Blog</span>
        <Separator orientation="vertical" />
        <span>Docs</span>
        <Separator orientation="vertical" />
        <span>Source</span>
      </div>
    </div>
  ),
}

/** ScrollArea: vertical list and horizontal strip with visible scrollbar. */
export const ScrollAreas: Story = {
  render: () => (
    <div className="flex items-start gap-8 p-6">
      <ScrollArea className="h-48 w-40 rounded-md border">
        <div className="p-3">
          <p className="mb-2 text-xs font-medium">Versions</p>
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} className="py-1 text-xs">
              v1.2.{19 - i}
              <Separator className="mt-2" />
            </div>
          ))}
        </div>
      </ScrollArea>

      <ScrollArea className="w-64 rounded-md border whitespace-nowrap">
        <div className="flex w-max gap-3 p-3">
          {["January", "February", "March", "April", "May", "June"].map(
            (month) => (
              <figure key={month} className="shrink-0">
                <div className="flex h-20 w-28 items-center justify-center rounded-md bg-muted text-xs">
                  {month}
                </div>
              </figure>
            )
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  ),
}

/** Collapsible expanded by default so the content is visible. */
export const Collapsibles: Story = {
  render: () => (
    <div className="w-80 p-6">
      <Collapsible defaultOpen className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">3 starred goals</span>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Toggle">
              <ChevronsUpDownIcon />
            </Button>
          </CollapsibleTrigger>
        </div>
        <div className="rounded-md border px-3 py-2 text-xs">Read 12 books</div>
        <CollapsibleContent className="flex flex-col gap-2">
          <div className="rounded-md border px-3 py-2 text-xs">
            Run 300 kilometers
          </div>
          <div className="rounded-md border px-3 py-2 text-xs">
            Ship the side project
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  ),
}

/** Item variant tones with media, content and actions. */
export const Items: Story = {
  render: () => (
    <div className="w-96 p-6">
      <ItemGroup className="gap-3">
        {ITEM_VARIANTS.map((variant) => (
          <Item key={variant} variant={variant}>
            <ItemMedia variant="icon">
              <TargetIcon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{variant} item</ItemTitle>
              <ItemDescription>
                Soft tone matching the app status formula.
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Badge variant="outline">{variant}</Badge>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </div>
  ),
}

/** Item sizes plus header/footer slots and separators in a group. */
export const ItemSizes: Story = {
  render: () => (
    <div className="w-96 p-6">
      <ItemGroup>
        {(["default", "sm", "xs"] as const).map((size, i) => (
          <div key={size} className="contents">
            {i > 0 && <ItemSeparator />}
            <Item variant="outline" size={size}>
              <ItemHeader>
                <span className="text-xs text-muted-foreground">
                  size: {size}
                </span>
                <Badge variant="ghost" size="default">
                  header
                </Badge>
              </ItemHeader>
              <ItemMedia variant="icon">
                <BellIcon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Notification digest</ItemTitle>
                <ItemDescription>Daily summary at 9:00.</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="xs">
                  Edit
                </Button>
              </ItemActions>
              <ItemFooter>
                <span className="text-xs text-muted-foreground">
                  footer slot
                </span>
              </ItemFooter>
            </Item>
          </div>
        ))}
      </ItemGroup>
    </div>
  ),
}

/** App header bar. */
export const AppHeader: Story = {
  parameters: { layout: "fullscreen" },
  render: () => <Header />,
}
