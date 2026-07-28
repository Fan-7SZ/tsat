import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { userEvent, within } from "storybook/test"

import { GoalSelect } from "@/components/goal/GoalSelect"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { GoalID } from "@/domain/value-objects/types"
import { db } from "@/persistence/db"
import { usePreparedStoryDb } from "@/stories/usePreparedStoryDb"

const GOAL_A = "goal-select-a" as GoalID
const GOAL_B = "goal-select-b" as GoalID

const sampleGoals: GoalEntity[] = [
  { id: GOAL_A, title: "Learn TypeScript", createdAt: new Date() },
  { id: GOAL_B, title: "Run a marathon", createdAt: new Date() },
]

async function setup() {
  await db.goals.bulkPut(sampleGoals)
}

async function teardown() {
  await db.goals.bulkDelete(sampleGoals.map((goal) => goal.id))
}

function Harness({
  initialValue,
  disabled,
}: {
  initialValue?: GoalID
  disabled?: boolean
}) {
  const ready = usePreparedStoryDb(setup, teardown)
  const [value, setValue] = useState<GoalID | undefined>(initialValue)

  if (!ready) return null

  return (
    <div className="w-72 p-6">
      <GoalSelect
        value={value}
        onChange={setValue}
        disabled={disabled}
        aria-label="Bound goal"
      />
    </div>
  )
}

const meta = {
  title: "Goal/GoalSelect",
  component: GoalSelect,
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 360 } },
  },
  args: {
    value: undefined,
    onChange: () => {},
  },
  tags: ["autodocs"],
} satisfies Meta<typeof GoalSelect>

export default meta
type Story = StoryObj<typeof meta>

/** Nothing bound — the leading "standalone (no goal)" option is selected. */
export const Standalone: Story = {
  render: () => <Harness />,
}

/** Bound to a goal from the seeded list. */
export const BoundToGoal: Story = {
  render: () => <Harness initialValue={GOAL_A} />,
}

/** Disabled while a rebind is in flight. */
export const Disabled: Story = {
  render: () => <Harness initialValue={GOAL_B} disabled />,
}

/** Open list: the standalone sentinel first, then goals sorted by title. */
export const OpenList: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole("combobox"))
    const body = within(canvasElement.ownerDocument.body)
    await body.findByText("Learn TypeScript")
  },
}
