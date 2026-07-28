import type { Meta, StoryObj } from "@storybook/react-vite"
import { SearchIcon, SendIcon } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

/**
 * Style gallery for the form family: Input, InputGroup, Textarea, Label,
 * Field, Checkbox, Switch, Select and Calendar.
 */
const meta = {
  title: "UI/Inputs",
  component: Input,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

/** Input and Textarea states: default, filled, disabled, invalid, file. */
export const TextInputs: Story = {
  render: () => (
    <div className="grid w-160 grid-cols-2 gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="ti-default">Default</Label>
        <Input id="ti-default" placeholder="Type something..." />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ti-filled">Filled</Label>
        <Input id="ti-filled" defaultValue="Hello world" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ti-disabled">Disabled</Label>
        <Input id="ti-disabled" disabled placeholder="Disabled" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ti-invalid">Invalid</Label>
        <Input id="ti-invalid" aria-invalid defaultValue="Bad value" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ti-file">File</Label>
        <Input id="ti-file" type="file" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ti-textarea">Textarea</Label>
        <Textarea id="ti-textarea" placeholder="Longer notes..." />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ti-textarea-disabled">Textarea disabled</Label>
        <Textarea id="ti-textarea-disabled" disabled placeholder="Disabled" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ti-textarea-invalid">Textarea invalid</Label>
        <Textarea id="ti-textarea-invalid" aria-invalid defaultValue="Oops" />
      </div>
    </div>
  ),
}

/** InputGroup addon alignments: inline text, icons, buttons and textarea. */
export const InputGroups: Story = {
  render: () => (
    <div className="flex w-96 flex-col gap-4 p-6">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Search tasks..." />
      </InputGroup>

      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>https://</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="example.com" />
        <InputGroupAddon align="inline-end">
          <InputGroupText>.io</InputGroupText>
        </InputGroupAddon>
      </InputGroup>

      <InputGroup>
        <InputGroupInput placeholder="Invite by email" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton variant="secondary">Send</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      <InputGroup>
        <InputGroupInput aria-invalid defaultValue="not-an-email" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs" aria-label="Send">
            <SendIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      <InputGroup>
        <InputGroupTextarea placeholder="Write a comment..." />
        <InputGroupAddon align="block-end">
          <InputGroupText>Markdown supported</InputGroupText>
          <InputGroupButton variant="default" className="ml-auto">
            Post
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
}

/** Field layout: vertical / horizontal orientations, error and fieldset. */
export const Fields: Story = {
  render: () => (
    <div className="w-96 p-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="f-name">Goal name</FieldLabel>
          <Input id="f-name" placeholder="Read 12 books" />
          <FieldDescription>Shown on the goal card.</FieldDescription>
        </Field>
        <Field data-invalid>
          <FieldLabel htmlFor="f-budget">Daily budget</FieldLabel>
          <Input id="f-budget" aria-invalid defaultValue="-30" />
          <FieldError>Budget must be a positive number.</FieldError>
        </Field>
        <FieldSeparator>Options</FieldSeparator>
        <Field orientation="horizontal">
          <Checkbox id="f-carry" defaultChecked />
          <FieldLabel htmlFor="f-carry" className="font-normal">
            Carry unfinished work to the next day
          </FieldLabel>
        </Field>
        <Field orientation="horizontal">
          <FieldLabel htmlFor="f-notify">Notifications</FieldLabel>
          <Switch id="f-notify" defaultChecked />
        </Field>
        <FieldSet>
          <FieldLegend>Visibility</FieldLegend>
          <FieldDescription>Who can see this goal.</FieldDescription>
          <Field orientation="horizontal">
            <Checkbox id="f-private" />
            <FieldLabel htmlFor="f-private" className="font-normal">
              Keep private
            </FieldLabel>
          </Field>
        </FieldSet>
      </FieldGroup>
    </div>
  ),
}

/** Checkbox and Switch: unchecked / checked / disabled combinations. */
export const Toggles: Story = {
  render: () => (
    <div className="grid w-fit grid-cols-[auto_repeat(4,auto)] items-center gap-x-6 gap-y-3 p-6">
      <span />
      {["off", "on", "off disabled", "on disabled"].map((label) => (
        <span key={label} className="text-xs text-muted-foreground">
          {label}
        </span>
      ))}
      <span className="text-xs text-muted-foreground">Checkbox</span>
      <Checkbox aria-label="Off" />
      <Checkbox aria-label="On" defaultChecked />
      <Checkbox aria-label="Off disabled" disabled />
      <Checkbox aria-label="On disabled" disabled defaultChecked />
      <span className="text-xs text-muted-foreground">Switch</span>
      <Switch aria-label="Off" />
      <Switch aria-label="On" defaultChecked />
      <Switch aria-label="Off disabled" disabled />
      <Switch aria-label="On disabled" disabled defaultChecked />
    </div>
  ),
}

/** Select trigger sizes and states, plus one opened listbox. */
export const Selects: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4 p-6 pb-56">
      <div className="flex items-center gap-4">
        <Select defaultValue="daily">
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="daily">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
          </SelectContent>
        </Select>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Placeholder" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">Option A</SelectItem>
          </SelectContent>
        </Select>
        <Select disabled defaultValue="daily">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Select defaultOpen defaultValue="week">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Repeat period</SelectLabel>
            <SelectItem value="day">Every day</SelectItem>
            <SelectItem value="week">Every week</SelectItem>
            <SelectItem value="month">Every month</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectItem value="custom" disabled>
            Custom (soon)
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
}

/** Calendar: single selection and dropdown caption layout. */
export const Calendars: Story = {
  render: () => (
    <div className="flex items-start gap-8 p-6">
      <Calendar
        mode="single"
        defaultMonth={new Date(2026, 5)}
        selected={new Date(2026, 5, 15)}
        className="rounded-md border"
      />
      <Calendar
        mode="range"
        captionLayout="dropdown"
        defaultMonth={new Date(2026, 5)}
        selected={{ from: new Date(2026, 5, 8), to: new Date(2026, 5, 19) }}
        className="rounded-md border"
      />
    </div>
  ),
}
