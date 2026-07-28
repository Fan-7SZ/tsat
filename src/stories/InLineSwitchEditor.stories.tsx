import type { Meta, StoryObj } from "@storybook/react-vite"

import { InLineSwitchEditor } from "@/components/shared/InLineSwitchEditor"

const meta = {
  title: "Components/InLineSwitchEditor",
  component: InLineSwitchEditor,
  parameters: {
    layout: "padded",
    docs: { story: { inline: false, iframeHeight: 480 } },
  },
  tags: ["autodocs"],
  argTypes: {
    className: {
      control: "text",
    },
  },
} satisfies Meta<typeof InLineSwitchEditor>

export default meta

type Story = StoryObj<typeof meta>

function ViewNode({ text }: { text: string }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm" tabIndex={0}>
      {text}
    </div>
  )
}

function EditNode({ placeholder }: { placeholder: string }) {
  return (
    <div className="space-y-2 rounded-md border border-dashed bg-card px-3 py-2">
      <input
        autoFocus
        defaultValue="双击后已进入编辑态"
        placeholder={placeholder}
        className="w-full rounded border px-2 py-1 text-sm"
      />
      <button className="rounded border px-2 py-1 text-xs" type="button">
        编辑态内部按钮（用于测试内部焦点切换）
      </button>
    </div>
  )
}

export const DefaultView: Story = {
  args: {
    className: "max-w-xl",
    view: <ViewNode text="默认展示 view。双击此区域切换到 edit。" />,
    edit: <EditNode placeholder="输入内容" />,
  },
}

export const BlurExitBehavior: Story = {
  args: {
    view: null,
    edit: null,
  },
  render: () => (
    <div className="max-w-xl space-y-3">
      <p className="text-xs text-muted-foreground">
        先双击进入编辑态，然后点击下方“外部按钮”，应退出回到 view。
      </p>
      <InLineSwitchEditor
        className="space-y-2"
        view={<ViewNode text="双击进入编辑；点击组件外部区域退出。" />}
        edit={<EditNode placeholder="点击外部按钮以触发 blur 退出" />}
      />
      <button className="rounded border px-3 py-2 text-sm" type="button">
        外部按钮（组件外）
      </button>
    </div>
  ),
}

export const KeyboardEnterEscape: Story = {
  args: {
    view: null,
    edit: null,
  },
  render: () => (
    <div className="max-w-xl space-y-4">
      <p className="text-xs text-muted-foreground">
        双击进入编辑后，按 Enter 或 Escape，都应回到 view。
      </p>
      <InLineSwitchEditor
        view={<ViewNode text="案例 A：双击后按 Enter 退出。" />}
        edit={<EditNode placeholder="按 Enter 退出" />}
      />
      <InLineSwitchEditor
        view={<ViewNode text="案例 B：双击后按 Escape 退出。" />}
        edit={<EditNode placeholder="按 Escape 退出" />}
      />
    </div>
  ),
}

export const FocusBoundary: Story = {
  args: {
    view: null,
    edit: null,
  },
  render: () => (
    <div className="max-w-xl space-y-3">
      <p className="text-xs text-muted-foreground">
        双击进入编辑后，在输入框与内部按钮之间切换焦点不应退出；点击外部按钮应退出。
      </p>
      <InLineSwitchEditor
        className="space-y-2"
        view={<ViewNode text="测试内部焦点边界。" />}
        edit={<EditNode placeholder="先点输入框，再点内部按钮" />}
      />
      <button className="rounded border px-3 py-2 text-sm" type="button">
        外部按钮（应触发退出）
      </button>
    </div>
  ),
}
