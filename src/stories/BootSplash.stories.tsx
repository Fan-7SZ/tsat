import type { Meta, StoryObj } from "@storybook/react-vite"

import { BootSplash } from "@/components/shared/BootSplash"

const meta = {
  title: "Shared/BootSplash",
  component: BootSplash,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof BootSplash>

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {
  args: { statusText: "加载中…" },
}

export const Syncing: Story = {
  args: { statusText: "正在同步…" },
}
