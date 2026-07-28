import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  InfoIcon,
  PlusIcon,
} from "lucide-react"

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * Style gallery for the feedback family: Alert, AlertDialog, Spinner,
 * Skeleton, Progress and Tooltip.
 */
const meta = {
  title: "UI/Feedback",
  component: Alert,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Alert>

export default meta
type Story = StoryObj<typeof meta>

/** Alert variants: plain, with icon, with action, destructive. */
export const Alerts: Story = {
  render: () => (
    <div className="flex w-120 flex-col gap-4 p-6">
      <Alert>
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>
          A plain alert with just a title and a description.
        </AlertDescription>
      </Alert>

      <Alert>
        <InfoIcon />
        <AlertTitle>Sync in progress</AlertTitle>
        <AlertDescription>
          Your changes will be uploaded when the connection is back.
        </AlertDescription>
      </Alert>

      <Alert>
        <CheckCircle2Icon />
        <AlertTitle>Goal archived</AlertTitle>
        <AlertDescription>
          You can restore it from the archive at any time.
        </AlertDescription>
        <AlertAction>
          <Button variant="outline" size="xs">
            Undo
          </Button>
        </AlertAction>
      </Alert>

      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Sync failed</AlertTitle>
        <AlertDescription>
          The server rejected the payload. Check your credentials and retry.
        </AlertDescription>
      </Alert>

      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Title-only destructive alert</AlertTitle>
      </Alert>
    </div>
  ),
}

/** Progress bar at several completion values. */
export const ProgressValues: Story = {
  render: () => (
    <div className="flex w-96 flex-col gap-5 p-6">
      {[0, 25, 50, 75, 100].map((value) => (
        <div key={value} className="flex items-center gap-3">
          <span className="w-10 text-right text-xs text-muted-foreground">
            {value}%
          </span>
          <Progress value={value} />
        </div>
      ))}
    </div>
  ),
}

/** Spinner sizes, standalone and inside buttons. */
export const Spinners: Story = {
  render: () => (
    <div className="flex items-center gap-6 p-6">
      <Spinner className="size-3" />
      <Spinner />
      <Spinner className="size-6" />
      <Spinner className="size-8" />
      <Button disabled>
        <Spinner />
        Loading
      </Button>
      <Button variant="outline" disabled>
        <Spinner />
        Syncing
      </Button>
    </div>
  ),
}

/** Skeleton shapes composed into a typical loading card. */
export const Skeletons: Story = {
  render: () => (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-24 w-80 rounded-lg" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-80" />
        <Skeleton className="h-3 w-72" />
        <Skeleton className="h-3 w-64" />
      </div>
    </div>
  ),
}

/** Tooltip on all four sides, kept open for the gallery. */
export const Tooltips: Story = {
  render: () => (
    <TooltipProvider>
      <div className="grid grid-cols-2 gap-x-24 gap-y-16 p-24">
        {(["top", "right", "bottom", "left"] as const).map((side) => (
          <Tooltip key={side} open>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm">
                {side}
              </Button>
            </TooltipTrigger>
            <TooltipContent side={side}>Tooltip on {side}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  ),
}

/** Tooltip with richer content. */
export const TooltipRichContent: Story = {
  render: () => (
    <TooltipProvider>
      <div className="p-24">
        <Tooltip open>
          <TooltipTrigger asChild>
            <Button size="icon" variant="secondary" aria-label="Add task">
              <PlusIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Add a task to today&apos;s plan
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
}

/** AlertDialog opened by default so the content renders without a click. */
export const AlertDialogOpen: Story = {
  render: () => (
    <AlertDialog defaultOpen>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this goal?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the goal and its 12 tasks. Completed history is kept.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
}
