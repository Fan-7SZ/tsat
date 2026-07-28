import type { Meta, StoryObj } from "@storybook/react-vite"

import {
  SettingField,
  SettingFieldDescription,
  SettingFieldError,
  SettingFieldTitle,
} from "@/components/shared/setting-field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const meta = {
  title: "Shared/SettingField",
  component: SettingField,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof SettingField>

export default meta
type Story = StoryObj<typeof meta>

/** Title + muted help text + control — the standard settings row. */
export const Default: Story = {
  render: () => (
    <div className="w-80 p-6">
      <SettingField>
        <SettingFieldTitle>Language</SettingFieldTitle>
        <SettingFieldDescription>
          Applies to the whole app immediately.
        </SettingFieldDescription>
        <Select defaultValue="en">
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="zh">中文</SelectItem>
          </SelectContent>
        </Select>
      </SettingField>
    </div>
  ),
}

/** Title only — for controls that need no explanation. */
export const TitleOnly: Story = {
  render: () => (
    <div className="w-80 p-6">
      <SettingField>
        <SettingFieldTitle>Display name</SettingFieldTitle>
        <Input placeholder="Enter a name" />
      </SettingField>
    </div>
  ),
}

/** `variant="destructive"` turns the description into an inline error line. */
export const DestructiveDescription: Story = {
  render: () => (
    <div className="w-80 p-6">
      <SettingField>
        <SettingFieldTitle>Sync provider</SettingFieldTitle>
        <SettingFieldDescription variant="destructive">
          Authorization failed. Please try again.
        </SettingFieldDescription>
        <Input placeholder="Provider" disabled />
      </SettingField>
    </div>
  ),
}

/** SettingFieldError — larger validation line under the control. */
export const WithError: Story = {
  render: () => (
    <div className="w-80 p-6">
      <SettingField>
        <SettingFieldTitle>Occurrences</SettingFieldTitle>
        <Input defaultValue="0" aria-invalid />
        <SettingFieldError>Must be at least 1.</SettingFieldError>
      </SettingField>
    </div>
  ),
}
