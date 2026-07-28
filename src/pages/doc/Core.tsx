import {
  DocPageHeader,
  DocPageDescription,
  DocGroup,
  DocSectionContent,
  DocSectionTitle,
  DocPageTitle,
  DocCallout,
  DocInlineLink,
  CodeBlock,
} from "@/components/style/DocStyle"
import { ClipboardCheck, Flag } from "lucide-react"
import { useLanguage } from "@/components/shared/language-provider"

export function Core() {
  const { language } = useLanguage()
  return language === "zh" ? <CoreZh /> : <CoreEn />
}

function CoreEn() {
  return (
    <div>
      <DocPageHeader>
        <DocPageTitle>Core Concepts</DocPageTitle>
        <DocPageDescription>
          TSAT applies two core concepts to split and manage a complex goal into
          smaller and manageable pieces: Goals and Tasks.
        </DocPageDescription>
      </DocPageHeader>
      <DocGroup>
        <DocSectionContent>
          <DocSectionTitle className="flex items-center gap-1">
            <Flag className="size-5" />
            Goals
          </DocSectionTitle>
          On a macro level, a goal represents something to be achieved. It can
          be completed in a short time, or worked on over a long period.
        </DocSectionContent>
        <DocSectionContent>
          <DocSectionTitle className="flex items-center gap-1">
            <ClipboardCheck className="size-5" />
            Tasks
          </DocSectionTitle>
          On a micro level, a task represents a specific action to be completed.
          It is a concrete basic unit that contributes to the achievement of a
          goal.
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>Example</DocSectionTitle>
          Let's say your goal is "A daily house cleaning routine". To complete
          this goal, you may then think about the following behaviors:
          <CodeBlock>
            {[
              '├── "Clean the kitchen"',
              '├── "Vacuum the living room"',
              '├── "Mop the bathroom floor"',
              '└── "Dust the furniture"',
            ].join("\n")}
          </CodeBlock>
          In this case, the goal is "A daily house cleaning routine", and the
          tasks are these behaviors. When you complete these tasks, you will
          have achieved your goal.
          <DocCallout tone="learn" className="mt-5" title="Quick Start">
            See how to set up a 'daily house cleaning routine' goal and its
            associated tasks in{" "}
            <DocInlineLink to="/doc/guides/quick-start">
              Quick Start
            </DocInlineLink>
            .
          </DocCallout>
        </DocSectionContent>
        <DocSectionContent>
          <DocSectionTitle>Goals vs Tasks</DocSectionTitle>
          Usually, a goal is a broader objective that requires multiple tasks to
          achieve. Tasks are the actionable steps that contribute to the
          completion of a goal. In other words, if you are unsure whether to
          create a goal or a task, just pick the goal. You can always break it
          down into tasks later.
        </DocSectionContent>
      </DocGroup>
    </div>
  )
}

function CoreZh() {
  return (
    <div>
      <DocPageHeader>
        <DocPageTitle>核心概念</DocPageTitle>
        <DocPageDescription>
          TSAT
          用两个核心概念把复杂的目标拆解成更小、可管理的单元:目标(Goal)与任务(Task)。
        </DocPageDescription>
      </DocPageHeader>
      <DocGroup>
        <DocSectionContent>
          <DocSectionTitle className="flex items-center gap-1">
            <Flag className="size-5" />
            目标
          </DocSectionTitle>
          宏观层面,目标代表一件想要达成的事。它可以在短期内完成,也可以是长期推进的方向。
        </DocSectionContent>
        <DocSectionContent>
          <DocSectionTitle className="flex items-center gap-1">
            <ClipboardCheck className="size-5" />
            任务
          </DocSectionTitle>
          微观层面,任务代表一个要完成的具体行动。它是推动目标达成的最小基本单元。
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>示例</DocSectionTitle>
          假设你的目标是「每日居家清洁」。为了完成这个目标,你可能会想到下面这些行动:
          <CodeBlock>
            {[
              "├── 「清理厨房」",
              "├── 「客厅吸尘」",
              "├── 「拖洗浴室地面」",
              "└── 「给家具除尘」",
            ].join("\n")}
          </CodeBlock>
          在这个例子里,目标是「每日居家清洁」,任务就是这些行动。当你完成这些任务,目标也就达成了。
          <DocCallout tone="learn" className="mt-5" title="快速上手">
            到{" "}
            <DocInlineLink to="/doc/guides/quick-start">快速上手</DocInlineLink>{" "}
            看看如何在 TSAT 中建立「每日居家清洁」这个目标及其任务。
          </DocCallout>
        </DocSectionContent>
        <DocSectionContent>
          <DocSectionTitle>目标 vs 任务</DocSectionTitle>
          通常,目标是需要多个任务才能达成的更大目的;任务则是推动目标完成的可执行步骤。换句话说,拿不准该建目标还是任务时,先建目标——之后随时可以把它拆成任务。
        </DocSectionContent>
      </DocGroup>
    </div>
  )
}
