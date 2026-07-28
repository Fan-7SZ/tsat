import { useRef, useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import {
  DependencyAssistPopover,
  type DependencyAssistPhase,
  type DependencyErrorKind,
} from "@/components/flow/DependencyAssistPopover"
// Direct (non-lazy) import: the lazy wrapper's empty Suspense fallback can
// leave the canvas blank in Storybook. FlowPanel.stories imports directly too.
import { FlowPanelDraft } from "@/components/flow/FlowPanel"
import { DependencyOptimizingOverlay } from "@/components/flow/DependencyOptimizingOverlay"
import type { DependencyEntity } from "@/domain/entities/DependencyEntity"

type Tree = DependencyEntity["tree"]

const MESSY_TREE: Tree = [
  { data: "n0", title: "需求调研", parent: null, children: [1] },
  { data: "n1", title: "方案设计", parent: [0], children: [2] },
  { data: "n2", title: "接口开发", parent: [1], children: [3] },
  { data: "n3", title: "前端联调", parent: [2], children: [4] },
  { data: "n4", title: "测试上线", parent: [3], children: null },
]

const OPTIMIZED_TREE: Tree = [
  { data: "n0", title: "需求调研", parent: null, children: [1, 2] },
  { data: "n1", title: "方案设计", parent: [0], children: [3] },
  { data: "n2", title: "接口开发", parent: [0], children: [3] },
  { data: "n3", title: "前端联调", parent: [1, 2], children: [4] },
  { data: "n4", title: "测试上线", parent: [3], children: null },
]

function makeDependency(tree: Tree): DependencyEntity {
  return { id: "dep-story-optimize", belongTo: "goal-1", tree }
}

/**
 * The popover lives in the FlowPanel toolbar. The graph stays live below it;
 * running an optimization mutates that graph in place (here: messy → parallel).
 */
function Harness({
  initialPhase = "idle",
  initialError = null,
  simulate = false,
}: {
  initialPhase?: DependencyAssistPhase
  initialError?: DependencyErrorKind | null
  simulate?: boolean
}) {
  const [tree, setTree] = useState<Tree>(MESSY_TREE)
  const [description, setDescription] = useState("")
  const [phase, setPhase] = useState<DependencyAssistPhase>(initialPhase)
  const [error, setError] = useState<DependencyErrorKind | null>(initialError)
  const timers = useRef<number[]>([])

  const runOptimize = () => {
    if (!simulate) return
    timers.current.forEach(window.clearTimeout)
    timers.current = []
    setError(null)
    setPhase("optimizing")
    timers.current.push(
      window.setTimeout(() => {
        setTree(OPTIMIZED_TREE)
        setPhase("idle")
      }, 1300)
    )
  }

  return (
    <div
      className="relative overflow-hidden rounded-md border"
      style={{ width: 680, height: 500 }}
    >
      <FlowPanelDraft
        dependency={makeDependency(tree)}
        onDraftTreeChange={setTree}
      />
      {/* Optimizing mask over the whole graph. */}
      {phase === "optimizing" && <DependencyOptimizingOverlay />}
      {/* Toolbar corner — where it sits next to Undo/Save in the real panel. */}
      <div className="absolute top-2 right-2 z-10">
        <DependencyAssistPopover
          description={description}
          onDescriptionChange={setDescription}
          phase={phase}
          error={error}
          onGenerate={runOptimize}
          onOpenAiSettings={() => alert("→ 打开设置对话框的 AI 辅助 tab")}
        />
      </div>
    </div>
  )
}

const meta = {
  title: "Flow/DependencyAssistPopover",
  component: DependencyAssistPopover,
  parameters: { layout: "centered" },
} satisfies Meta<typeof DependencyAssistPopover>

export default meta
// Render-only stories: every story mounts the self-contained Harness and never
// reads args, so the story type is left unbound from the component's props.
type Story = StoryObj

/** 空闲态:点工具栏按钮弹出输入浮层。 */
export const Idle: Story = {
  render: () => <Harness />,
}

/** 优化中:按钮转 spinner、禁用。 */
export const Optimizing: Story = {
  render: () => <Harness initialPhase="optimizing" />,
}

/** 网络连接失败:错误文案 + 前往设置链接。 */
export const ErrorNetwork: Story = {
  render: () => <Harness initialError="network" />,
}

/** API/配置错误:不同文案 + 前往设置链接。 */
export const ErrorApi: Story = {
  render: () => <Harness initialError="api" />,
}

/** 交互演示:点「优化」跑一遍,图从链式变并行。 */
export const LiveOptimize: Story = {
  render: () => <Harness simulate />,
}
