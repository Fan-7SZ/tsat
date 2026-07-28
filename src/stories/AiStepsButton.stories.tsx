import { useRef, useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import {
  AiStepsButton,
  type StepsAutofillPhase,
} from "@/components/task/AiStepsButton"
import { StepsSkeletonList } from "@/components/task/StepsSkeletonList"
import { StepsEditor } from "@/components/task/StepsEditor"
import { createStep, type Step } from "@/domain/value-objects/types"

const GENERATED = [
  "梳理目标与验收标准",
  "拆分子任务并排期",
  "搭建基础框架",
  "实现核心逻辑",
  "自测与联调",
  "回归并提交评审",
]

/**
 * A realistic steps section (heading + AI button + list) so the button and
 * skeleton can be reviewed in the context they'll ship in.
 */
function Harness({
  initial = [],
  initialPhase = "idle",
  /** When true, clicking the button runs a fake counting → filling → done. */
  simulate = false,
}: {
  initial?: string[]
  initialPhase?: StepsAutofillPhase
  simulate?: boolean
}) {
  const [steps, setSteps] = useState<Step[]>(() => initial.map(createStep))
  const [stepInput, setStepInput] = useState("")
  const [phase, setPhase] = useState<StepsAutofillPhase>(initialPhase)
  const [plannedCount, setPlannedCount] = useState(GENERATED.length)
  const timers = useRef<number[]>([])

  const run = () => {
    timers.current.forEach(window.clearTimeout)
    timers.current = []
    setPhase("counting")
    timers.current.push(
      window.setTimeout(() => {
        setPlannedCount(GENERATED.length)
        setPhase("filling")
      }, 1100)
    )
    timers.current.push(
      window.setTimeout(() => {
        setSteps(GENERATED.map(createStep))
        setPhase("idle")
      }, 2400)
    )
  }

  return (
    <div className="flex w-96 flex-col gap-3 p-6">
      <div className="flex items-center justify-between">
        <h4 className="heading-4">步骤</h4>
        <AiStepsButton phase={phase} onClick={simulate ? run : undefined} />
      </div>

      {phase !== "idle" ? (
        <StepsSkeletonList count={phase === "counting" ? 3 : plannedCount} />
      ) : (
        <StepsEditor
          steps={steps}
          stepInput={stepInput}
          onStepInputChange={setStepInput}
          onAddStep={() => {
            const trimmed = stepInput.trim()
            if (!trimmed) return
            setSteps((s) => [...s, createStep(trimmed)])
            setStepInput("")
          }}
          onUpdateStep={(index, value) =>
            setSteps((s) =>
              s.map((v, i) => (i === index ? { ...v, title: value } : v))
            )
          }
          onRemoveStep={(index) =>
            setSteps((s) => s.filter((_, i) => i !== index))
          }
          onReorderSteps={setSteps}
          placeholder="添加步骤…"
        />
      )}
    </div>
  )
}

const meta = {
  title: "Task/AiStepsButton",
  component: AiStepsButton,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof AiStepsButton>

export default meta
type Story = StoryObj<typeof meta>

/** 空步骤:标题栏放 AI 补全按钮,列表为空。 */
export const Empty: Story = {
  render: () => <Harness />,
}

/** 已有步骤:按钮与现有列表共存(补全会覆盖/追加,接入时定语义)。 */
export const WithSteps: Story = {
  render: () => <Harness initial={["先做需求评审", "再出设计稿"]} />,
}

/** 确定数量中:按钮 disable + spinner,列表用 3 行占位骨架。 */
export const Counting: Story = {
  render: () => <Harness initialPhase="counting" />,
}

/** 补全内容中:数量已定,按已定条数铺骨架。 */
export const Filling: Story = {
  render: () => <Harness initialPhase="filling" />,
}

/** 交互演示:点按钮跑一遍 确定数量 → 补全内容 → 完成。 */
export const LiveGenerate: Story = {
  render: () => <Harness simulate />,
}
