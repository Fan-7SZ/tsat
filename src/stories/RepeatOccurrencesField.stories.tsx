import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { RepeatOccurrencesField } from "@/components/task/RepeatOccurrencesField"
import { useLanguage } from "@/components/shared/language-provider"

function Harness({
  withEstimate = false,
  withMessage = false,
}: {
  withEstimate?: boolean
  withMessage?: boolean
}) {
  const { t } = useLanguage()
  const [total, setTotal] = useState(3)
  return (
    <div className="w-96 p-6">
      <RepeatOccurrencesField
        label={t.taskDetail.estimatedOccurrences}
        total={total}
        onTotalChange={setTotal}
        message={withMessage ? t.taskDetail.totalExceedsOccurrences(2) : null}
        showEstimateActions={withEstimate}
        onAutoEstimate={() => setTotal(5)}
        autoEstimateLabel={t.taskDetail.autoEstimate}
        previewDatesLabel={t.taskDetail.previewDates}
        previewModifiers={{ planned: [new Date()] }}
        isPreviewDateDisabled={() => false}
      />
    </div>
  )
}

const meta = {
  title: "Task/RepeatOccurrencesField",
  component: RepeatOccurrencesField,
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 480 } },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof RepeatOccurrencesField>

export default meta
type Story = StoryObj<typeof meta>

const baseArgs = {
  label: "Estimated occurrences",
  total: 3,
  onTotalChange: () => {},
  message: null,
}

export const Basic: Story = {
  args: baseArgs,
  render: () => <Harness />,
}

export const WithEstimateActions: Story = {
  args: baseArgs,
  render: () => <Harness withEstimate />,
}

export const WithLimitMessage: Story = {
  args: baseArgs,
  render: () => <Harness withMessage />,
}
