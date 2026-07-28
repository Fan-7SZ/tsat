import type { Meta, StoryObj } from "@storybook/react-vite"
import { userEvent, waitFor, within } from "storybook/test"
import { CalendarIcon, SettingsIcon, UserIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

/**
 * Style gallery for the overlay family: Dialog, Sheet, Popover, HoverCard,
 * DropdownMenu and ContextMenu. Overlays are rendered open (controlled or
 * defaultOpen) so their content is visible without interaction.
 */
const meta = {
  title: "UI/Overlays",
  component: Dialog,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Dialog>

export default meta
type Story = StoryObj<typeof meta>

/** Dialog opened by default: header, form body and footer. */
export const DialogOpen: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
          <DialogDescription>
            Rename the task and save your changes.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 px-4">
          <Label htmlFor="dlg-name">Name</Label>
          <Input id="dlg-name" defaultValue="Morning run" />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

/** Sheet opened from the right with header, body and footer. */
export const SheetOpen: Story = {
  render: () => (
    <Sheet defaultOpen>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Task details</SheetTitle>
          <SheetDescription>
            Inspect and edit the task without leaving the page.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4">
          <Label htmlFor="sheet-name">Name</Label>
          <Input id="sheet-name" defaultValue="Weekly review" />
        </div>
        <SheetFooter>
          <Button>Save</Button>
          <Button variant="outline">Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
}

/** Popover kept open below its trigger. */
export const PopoverOpen: Story = {
  render: () => (
    <div className="flex items-start justify-center p-8 pb-48">
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <Button variant="outline">
            <CalendarIcon data-icon="inline-start" />
            Schedule
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium">Plan for a day</p>
            <p className="text-xs text-muted-foreground">
              Pick the day this task should land on.
            </p>
            <Input placeholder="2026-07-01" />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  ),
}

/** HoverCard kept open, showing a small profile preview. */
export const HoverCardOpen: Story = {
  render: () => (
    <div className="flex items-start justify-center p-8 pb-40">
      <HoverCard open>
        <HoverCardTrigger asChild>
          <Button variant="link">@itrack</Button>
        </HoverCardTrigger>
        <HoverCardContent className="w-64">
          <div className="flex gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-muted">
              <UserIcon className="size-4" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium">ITrack</p>
              <p className="text-xs text-muted-foreground">
                Local-first goal tracking with a daily planner.
              </p>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  ),
}

/** DropdownMenu kept open: label, items, shortcuts, checkbox and radio. */
export const DropdownMenuOpen: Story = {
  render: () => (
    <div className="flex items-start justify-center p-8 pb-80">
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <SettingsIcon data-icon="inline-start" />
            Options
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52">
          <DropdownMenuLabel>Task actions</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem>
              Edit
              <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem inset>Duplicate</DropdownMenuItem>
            <DropdownMenuItem disabled>Archive</DropdownMenuItem>
            <DropdownMenuItem variant="destructive">
              Delete
              <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked>
            Show completed
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={false}>
            Show archived
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuRadioGroup value="due">
            <DropdownMenuRadioItem value="due">Due date</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
}

/**
 * ContextMenu cannot be forced open via props, so the play function
 * right-clicks the trigger area to render the menu content.
 */
export const ContextMenuOpen: Story = {
  render: () => (
    <div className="flex items-start justify-center p-8 pb-72">
      <ContextMenu>
        <ContextMenuTrigger className="flex h-28 w-64 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
          Right-click here
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuLabel>Row actions</ContextMenuLabel>
          <ContextMenuItem>
            Open
            <ContextMenuShortcut>⏎</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem inset>Rename</ContextMenuItem>
          <ContextMenuCheckboxItem checked>Pinned</ContextMenuCheckboxItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive">Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.pointer({
      keys: "[MouseRight]",
      target: canvas.getByText("Right-click here"),
    })
    await waitFor(() => {
      if (!document.querySelector("[data-slot=context-menu-content]")) {
        throw new Error("context menu did not open")
      }
    })
  },
}
