import {
  CodeBlock,
  DocCallout,
  DocGroup,
  DocInlineLink,
  DocLink,
  DocLinkGroup,
  DocLinkList,
  DocPageDescription,
  DocPageHeader,
  DocPageTitle,
  DocSectionContent,
  DocSectionImage,
  DocSectionTitle,
} from "@/components/style/DocStyle"
import { useLanguage } from "@/components/shared/language-provider"

export function QuickStart() {
  const { language } = useLanguage()
  return language === "zh" ? <QuickStartZh /> : <QuickStartEn />
}

function QuickStartEn() {
  return (
    <div>
      <DocPageHeader>
        <DocPageTitle>Quick Start</DocPageTitle>
        <DocPageDescription>
          See how to set up a 'daily house cleaning routine' goal and its
          associated tasks in TSAT.
        </DocPageDescription>
      </DocPageHeader>
      <DocGroup>
        <DocSectionContent>
          <DocCallout tone="learn" title="Goal and Tasks">
            See definitions of Goal and Tasks in{" "}
            <DocInlineLink to="/doc/concepts/core">Core Concepts</DocInlineLink>{" "}
            and what they mean in "A daily house cleaning routine".
          </DocCallout>
        </DocSectionContent>
        <DocSectionContent>
          <DocSectionTitle>Creating a Goal</DocSectionTitle>
          To create a goal, click the "New Goal" button on the main page. In
          the popup dialog, enter the goal title 'A daily house cleaning
          routine', then click "Create Goal".
          <DocSectionImage src="/doc/create-goal.png" alt="create-goal" />
          <DocCallout tone="info" title="The due date is optional">
            A goal only needs a title. Add a due date if you want the goal
            pulled toward today as the date approaches — a goal that uses a
            Trigger can't have one, since the trigger does the scheduling.
          </DocCallout>
          You've now created a goal, and it will show up on the main page as
          well as in the my-goals page.
          <DocSectionImage
            src="/doc/goal-item-after-created.png"
            alt="goal-item-after-created"
          />
          Now you may notice that the goal is empty and its progress is 0%.
          Next, you need to add tasks to this goal.
        </DocSectionContent>
        <DocSectionContent>
          <DocSectionTitle>Adding Tasks</DocSectionTitle>
          As we mentioned in the Core section, 'A daily house cleaning routine'
          contains the following tasks:
          <CodeBlock>
            {[
              '├── "Clean the kitchen"',
              '├── "Vacuum the living room"',
              '├── "Mop the bathroom floor"',
              '└── "Dust the furniture"',
            ].join("\n")}
          </CodeBlock>
          To add tasks, click the "Add Task" button on the home page. In the
          popup dialog, enter the task title and bind it to the goal, then click
          "Create Task". Repeat this process for all the tasks above.
          <DocSectionImage src="/doc/create-task.png" alt="create-task" />
          After adding all the tasks, you will see them in the my-tasks page.
          <DocSectionImage
            src="/doc/task-items-after-created.png"
            alt="task-items-after-created"
          />
          Back on the my-goals page, you'll see that the goal has updated its
          task count (now 4, matching the tasks added above), while the progress
          is still 0%, since none of the tasks have been completed yet.
          <DocSectionImage
            src="/doc/goal-item-after-binding-tasks.png"
            alt="goal-item-after-binding-tasks"
          />
          <DocCallout tone="tip" title="A task can be done multiple times">
            A task counts as single by default, but you can raise its{" "}
            <DocInlineLink to="/doc/concepts/estimated-occurrences">
              Estimated Occurrences
            </DocInlineLink>{" "}
            so it needs several completions.
          </DocCallout>
        </DocSectionContent>
        <DocSectionContent>
          <DocSectionTitle>Complete a Task</DocSectionTitle>
          Now let's make the progress change. Go to the my-tasks page and pick
          one of the tasks, right click and select "Mark as Done" in the context
          menu. Then back on the my-goals page, you'll see the progress has
          changed to 25%, since one of the four tasks has been completed.
          <DocSectionImage
            src="/doc/goal-item-update.png"
            alt="goal-item-update"
          />
          Then after all the tasks have been completed, the progress will be
          100% and the goal will be marked as done.
          <DocSectionImage
            src="/doc/goal-item-mark-done.png"
            alt="goal-item-mark-done"
          />
          <DocCallout tone="tip" title="Prefer the daily to-do flow">
            This example marked tasks done by hand to keep it short. Day to day,
            complete tasks through the daily to-do flow instead — see{" "}
            <DocInlineLink to="/doc/concepts/daily-focus">
              Daily Focus
            </DocInlineLink>
            .
          </DocCallout>
        </DocSectionContent>
        <DocSectionContent>
          <DocSectionTitle>Next Steps</DocSectionTitle>
          That's it! That's how goals and tasks work in TSAT. You first create a
          goal, which is something you want to achieve — the thing that comes to
          mind right away when you think about it. Then you break it down into
          smaller, trackable tasks. So to reach a goal, you just focus on each
          task and complete them one by one.
        </DocSectionContent>
        <DocSectionContent>
          You may want to explore more in the following guides.
          <DocLinkList>
            <DocLinkGroup title="Working Flow">
              <DocLink to="/doc/concepts/trigger-and-repeat-rule#trigger">
                Trigger
              </DocLink>
              <DocLink to="/doc/concepts/trigger-and-repeat-rule#repeat-rule">
                RepeatRule
              </DocLink>
              <DocLink to="/doc/concepts/daily-focus">Daily Focus</DocLink>
            </DocLinkGroup>
            <DocLinkGroup title="Built-in Tools">
              <DocLink to="/doc/guides/sync-setup">Sync Setup</DocLink>
              <DocLink to="/doc/guides/ai-setup">AI Setup</DocLink>
            </DocLinkGroup>
          </DocLinkList>
        </DocSectionContent>
      </DocGroup>
    </div>
  )
}

function QuickStartZh() {
  return (
    <div>
      <DocPageHeader>
        <DocPageTitle>快速上手</DocPageTitle>
        <DocPageDescription>
          看看如何在 TSAT 中建立「每日居家清洁」这个目标及其任务。
        </DocPageDescription>
      </DocPageHeader>
      <DocGroup>
        <DocSectionContent>
          <DocCallout tone="learn" title="目标与任务">
            目标与任务的定义,以及它们在「每日居家清洁」里分别指什么,见{" "}
            <DocInlineLink to="/doc/concepts/core">核心概念</DocInlineLink>。
          </DocCallout>
        </DocSectionContent>
        <DocSectionContent>
          <DocSectionTitle>创建目标</DocSectionTitle>
          在主页点击「新建目标」按钮,在弹出的对话框里输入目标名称「每日居家清洁」,然后点击「创建目标」。
          <DocSectionImage src="/doc/create-goal.png" alt="create-goal" />
          <DocCallout tone="info" title="截止日期是可选的">
            目标只需要一个名称。设置了截止日期后,临近时目标会被拉向今天;使用触发器的目标则不能设截止日期——调度交给触发器。
          </DocCallout>
          目标创建好后,会同时显示在主页和「我的目标」页里。
          <DocSectionImage
            src="/doc/goal-item-after-created.png"
            alt="goal-item-after-created"
          />
          你会发现目标现在是空的,进度为 0%。接下来要给它添加任务。
        </DocSectionContent>
        <DocSectionContent>
          <DocSectionTitle>添加任务</DocSectionTitle>
          正如核心概念里提到的,「每日居家清洁」包含这些任务:
          <CodeBlock>
            {[
              "├── 「清理厨房」",
              "├── 「客厅吸尘」",
              "├── 「拖洗浴室地面」",
              "└── 「给家具除尘」",
            ].join("\n")}
          </CodeBlock>
          在主页点击「添加任务」按钮,在弹出的对话框里输入任务名称并关联到目标,然后点击「创建任务」。对上面每个任务重复这一步。
          <DocSectionImage src="/doc/create-task.png" alt="create-task" />
          任务全部添加后,可以在「我的任务」页里看到它们。
          <DocSectionImage
            src="/doc/task-items-after-created.png"
            alt="task-items-after-created"
          />
          回到「我的目标」页,你会发现目标的任务数已更新(现在是
          4,对应上面添加的任务),而进度仍是 0%——因为还没有任何任务被完成。
          <DocSectionImage
            src="/doc/goal-item-after-binding-tasks.png"
            alt="goal-item-after-binding-tasks"
          />
          <DocCallout tone="tip" title="任务可以执行多次">
            任务默认是单次的,但你可以调高它的{" "}
            <DocInlineLink to="/doc/concepts/estimated-occurrences">
              预计次数
            </DocInlineLink>
            ,让它需要执行多次才算完成。
          </DocCallout>
        </DocSectionContent>
        <DocSectionContent>
          <DocSectionTitle>完成任务</DocSectionTitle>
          现在让进度动起来。到「我的任务」页,选中一个任务条目,右键选择「标记完成」。回到「我的目标」页,进度变成了
          25%——四个任务完成了一个。
          <DocSectionImage
            src="/doc/goal-item-update.png"
            alt="goal-item-update"
          />
          当所有任务都完成后,进度到达 100%,目标会被标记为已完成。
          <DocSectionImage
            src="/doc/goal-item-mark-done.png"
            alt="goal-item-mark-done"
          />
          <DocCallout tone="tip" title="日常更推荐每日待办流程">
            这个示例为了简短,直接手动标记了完成。日常使用中,更推荐通过每日待办流程来完成任务——见{" "}
            <DocInlineLink to="/doc/concepts/daily-focus">
              每日聚焦
            </DocInlineLink>
            。
          </DocCallout>
        </DocSectionContent>
        <DocSectionContent>
          <DocSectionTitle>接下来</DocSectionTitle>
          就是这样!这就是 TSAT
          里目标与任务的运作方式:先创建一个目标——它是你想达成、并且一想到就会立刻浮现的那件事;再把它拆成更小的可追踪任务。之后要达成目标,只需逐个专注地完成这些任务。
        </DocSectionContent>
        <DocSectionContent>
          你可能还想继续探索下面这些页面。
          <DocLinkList>
            <DocLinkGroup title="工作流">
              <DocLink to="/doc/concepts/trigger-and-repeat-rule#trigger">
                触发器
              </DocLink>
              <DocLink to="/doc/concepts/trigger-and-repeat-rule#repeat-rule">
                重复规则
              </DocLink>
              <DocLink to="/doc/concepts/daily-focus">每日聚焦</DocLink>
            </DocLinkGroup>
            <DocLinkGroup title="内置工具">
              <DocLink to="/doc/guides/sync-setup">同步设置</DocLink>
              <DocLink to="/doc/guides/ai-setup">AI 设置</DocLink>
            </DocLinkGroup>
          </DocLinkList>
        </DocSectionContent>
      </DocGroup>
    </div>
  )
}
