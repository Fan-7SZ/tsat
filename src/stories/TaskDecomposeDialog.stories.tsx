import { useRef, useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import {
  TaskDecomposeDialog,
  type DecomposeErrorKind,
  type DecomposePhase,
  type DecomposeTaskBadge,
} from "@/components/dialogs/TaskDecomposeDialog"
import { Button } from "@/components/ui/button"

const GENERATED = [
  "调研竞品与需求",
  "设计信息架构",
  "搭建页面框架",
  "接入数据与联调",
  "上线与回归测试",
]

function newId() {
  return `b-${Math.floor(Math.random() * 1e9).toString(36)}`
}

function Harness({
  initialTasks = [],
  initialPhase = "idle",
  initialError = null,
  goalTitle = "重构 AI 辅助为场景化小对话框",
  /** When true, Generate runs a fake count → per-badge fill flow. */
  simulate = false,
}: {
  initialTasks?: DecomposeTaskBadge[]
  initialPhase?: DecomposePhase
  initialError?: DecomposeErrorKind | null
  goalTitle?: string
  simulate?: boolean
}) {
  const [open, setOpen] = useState(true)
  const [description, setDescription] = useState("")
  const [tasks, setTasks] = useState<DecomposeTaskBadge[]>(initialTasks)
  const [phase, setPhase] = useState<DecomposePhase>(initialPhase)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<DecomposeErrorKind | null>(initialError)
  const timers = useRef<number[]>([])

  const toggle = (id: string) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    )

  const runGenerate = () => {
    timers.current.forEach(window.clearTimeout)
    timers.current = []
    setError(null)

    if (tasks.length === 0) {
      setPhase("counting")
      setBusy(true)
      timers.current.push(
        window.setTimeout(() => {
          const seeds = GENERATED.map(() => ({
            id: newId(),
            title: "",
            filling: true,
          }))
          setTasks(seeds)
          setPhase("idle")
          timers.current.push(
            window.setTimeout(() => {
              setTasks(
                seeds.map((b, i) => ({
                  ...b,
                  title: GENERATED[i],
                  filling: false,
                }))
              )
              setBusy(false)
            }, 1200)
          )
        }, 1000)
      )
      return
    }

    const targetIds = new Set(
      tasks.filter((t) => t.selected || !t.title.trim()).map((t) => t.id)
    )
    if (targetIds.size === 0) return
    setTasks((prev) =>
      prev.map((t) => (targetIds.has(t.id) ? { ...t, filling: true } : t))
    )
    setBusy(true)
    let i = 0
    timers.current.push(
      window.setTimeout(() => {
        setTasks((prev) =>
          prev.map((t) =>
            targetIds.has(t.id)
              ? {
                  ...t,
                  title: `新任务 ${(i++, i)}`,
                  filling: false,
                  selected: false,
                }
              : t
          )
        )
        setBusy(false)
      }, 1200)
    )
  }

  return (
    <>
      {!open && <Button onClick={() => setOpen(true)}>打开对话框</Button>}
      <TaskDecomposeDialog
        open={open}
        onOpenChange={setOpen}
        goalTitle={goalTitle}
        description={description}
        onDescriptionChange={setDescription}
        tasks={tasks}
        onTasksChange={setTasks}
        onToggleSelect={toggle}
        phase={phase}
        busy={busy}
        error={error}
        onGenerate={simulate ? runGenerate : () => {}}
        onConfirm={() => setOpen(false)}
        onOpenAiSettings={() => alert("→ 打开设置对话框的 AI 辅助 tab")}
      />
    </>
  )
}

const meta = {
  title: "Dialogs/TaskDecomposeDialog",
  component: TaskDecomposeDialog,
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 640 } },
  },
} satisfies Meta<typeof TaskDecomposeDialog>

export default meta
// Render-only stories: every story mounts the self-contained Harness and never
// reads args, so the story type is left unbound from the component's props.
type Story = StoryObj

/** 空态:还没有任务。 */
export const Empty: Story = {
  render: () => <Harness />,
}

/** 混合:已有任务(带 taskId,不可删)+ 新任务;都可编辑、可勾选。 */
export const WithExisting: Story = {
  render: () => (
    <Harness
      initialTasks={[
        { id: "e1", title: "立项与目标对齐", taskId: "e1" },
        { id: "e2", title: "现状盘点", taskId: "e2" },
        { id: "n1", title: "拆分场景化入口" },
        { id: "n2", title: "" },
      ]}
    />
  ),
}

/** 选中态:勾选的 badge 高亮(生成时会被重新填充)。 */
export const Selected: Story = {
  render: () => (
    <Harness
      initialTasks={[
        { id: "a", title: "调研", selected: true },
        { id: "b", title: "设计" },
        { id: "c", title: "", selected: false },
      ]}
    />
  ),
}

/** 逐 badge 填充中:部分 badge 显示骨架。 */
export const Filling: Story = {
  render: () => (
    <Harness
      initialTasks={[
        { id: "a", title: "调研" },
        { id: "b", title: "", filling: true },
        { id: "c", title: "", filling: true },
      ]}
    />
  ),
}

/** 确定数量中(0 任务时):整块骨架。 */
export const Counting: Story = {
  render: () => <Harness initialPhase="counting" />,
}

/** 网络连接失败。 */
export const ErrorNetwork: Story = {
  render: () => <Harness initialError="network" />,
}

/** API/配置错误。 */
export const ErrorApi: Story = {
  render: () => <Harness initialError="api" />,
}

/** 交互演示:空态点生成 → 定数量 → 逐 badge 填充。 */
export const LiveGenerate: Story = {
  render: () => <Harness simulate />,
}
