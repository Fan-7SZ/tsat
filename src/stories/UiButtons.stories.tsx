import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  ArchiveIcon,
  BoldIcon,
  CalendarIcon,
  ChevronDownIcon,
  CopyIcon,
  ItalicIcon,
  PlusIcon,
  TrashIcon,
  UnderlineIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@/components/ui/button-group"
import { Spinner } from "@/components/ui/spinner"

const BUTTON_VARIANTS = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
] as const

const BUTTON_SIZES = ["xs", "sm", "default", "lg"] as const
const ICON_SIZES = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const

const BADGE_VARIANTS = [
  "default",
  "secondary",
  "destructive",
  "outline",
  "ghost",
  "link",
] as const

/**
 * Style gallery for the button family: Button, ButtonGroup and Badge.
 * Each grid enumerates variant x size x state combinations.
 */
const meta = {
  title: "UI/Buttons",
  component: Button,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

/** Every Button variant crossed with every text size. */
export const ButtonMatrix: Story = {
  render: () => (
    <div className="grid w-fit grid-cols-[auto_repeat(4,auto)] items-center gap-x-4 gap-y-3 p-6">
      <span />
      {BUTTON_SIZES.map((size) => (
        <span key={size} className="text-xs text-muted-foreground">
          {size}
        </span>
      ))}
      {BUTTON_VARIANTS.map((variant) => (
        <div key={variant} className="contents">
          <span className="text-xs text-muted-foreground">{variant}</span>
          {BUTTON_SIZES.map((size) => (
            <Button key={size} variant={variant} size={size}>
              Button
            </Button>
          ))}
        </div>
      ))}
    </div>
  ),
}

/** Icon-only sizes for every variant. */
export const IconButtons: Story = {
  render: () => (
    <div className="grid w-fit grid-cols-[auto_repeat(4,auto)] items-center gap-x-4 gap-y-3 p-6">
      <span />
      {ICON_SIZES.map((size) => (
        <span key={size} className="text-xs text-muted-foreground">
          {size}
        </span>
      ))}
      {BUTTON_VARIANTS.map((variant) => (
        <div key={variant} className="contents">
          <span className="text-xs text-muted-foreground">{variant}</span>
          {ICON_SIZES.map((size) => (
            <Button key={size} variant={variant} size={size} aria-label="Add">
              <PlusIcon />
            </Button>
          ))}
        </div>
      ))}
    </div>
  ),
}

/** Disabled, loading and icon-adorned states per variant. */
export const ButtonStates: Story = {
  render: () => (
    <div className="grid w-fit grid-cols-[auto_repeat(4,auto)] items-center gap-x-4 gap-y-3 p-6">
      <span />
      {["disabled", "loading", "leading icon", "trailing icon"].map((label) => (
        <span key={label} className="text-xs text-muted-foreground">
          {label}
        </span>
      ))}
      {BUTTON_VARIANTS.map((variant) => (
        <div key={variant} className="contents">
          <span className="text-xs text-muted-foreground">{variant}</span>
          <Button variant={variant} disabled>
            Disabled
          </Button>
          <Button variant={variant} disabled>
            <Spinner />
            Saving
          </Button>
          <Button variant={variant}>
            <CalendarIcon data-icon="inline-start" />
            Schedule
          </Button>
          <Button variant={variant}>
            Open
            <ChevronDownIcon data-icon="inline-end" />
          </Button>
        </div>
      ))}
    </div>
  ),
}

/** Horizontal and vertical groups, separators, text and mixed content. */
export const ButtonGroups: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-6 p-6">
      <ButtonGroup>
        <Button variant="outline">
          <BoldIcon />
        </Button>
        <Button variant="outline">
          <ItalicIcon />
        </Button>
        <Button variant="outline">
          <UnderlineIcon />
        </Button>
      </ButtonGroup>

      <ButtonGroup>
        <Button variant="secondary">Save</Button>
        <ButtonGroupSeparator />
        <Button variant="secondary" size="icon" aria-label="More options">
          <ChevronDownIcon />
        </Button>
      </ButtonGroup>

      <ButtonGroup>
        <ButtonGroupText>https://</ButtonGroupText>
        <Button variant="outline">example.com</Button>
        <Button variant="outline" size="icon" aria-label="Copy">
          <CopyIcon />
        </Button>
      </ButtonGroup>

      <ButtonGroup orientation="vertical">
        <Button variant="outline">
          <ArchiveIcon data-icon="inline-start" />
          Archive
        </Button>
        <Button variant="outline">
          <CopyIcon data-icon="inline-start" />
          Duplicate
        </Button>
        <Button variant="destructive">
          <TrashIcon data-icon="inline-start" />
          Delete
        </Button>
      </ButtonGroup>
    </div>
  ),
}

/** Badge variants crossed with both sizes, plus icon and count usage. */
export const Badges: Story = {
  render: () => (
    <div className="grid w-fit grid-cols-[auto_repeat(4,auto)] items-center gap-x-4 gap-y-3 p-6">
      <span />
      {["default", "lg", "with icon", "count"].map((label) => (
        <span key={label} className="text-xs text-muted-foreground">
          {label}
        </span>
      ))}
      {BADGE_VARIANTS.map((variant) => (
        <div key={variant} className="contents">
          <span className="text-xs text-muted-foreground">{variant}</span>
          <Badge variant={variant}>Badge</Badge>
          <Badge variant={variant} size="lg">
            Badge
          </Badge>
          <Badge variant={variant}>
            <CalendarIcon />
            Due today
          </Badge>
          <Badge variant={variant}>99+</Badge>
        </div>
      ))}
    </div>
  ),
}
