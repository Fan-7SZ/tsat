import {
  DocCallout,
  DocGroup,
  DocInlineLink,
  DocList,
  DocPageDescription,
  DocPageHeader,
  DocPageTitle,
  DocSectionContent,
  DocSectionImage,
  DocSectionTitle,
} from "@/components/style/DocStyle"
import { useLanguage } from "@/components/shared/language-provider"

export function EstimatedOccurrences() {
  const { language } = useLanguage()
  return language === "zh" ? (
    <EstimatedOccurrencesZh />
  ) : (
    <EstimatedOccurrencesEn />
  )
}

function EstimatedOccurrencesEn() {
  return (
    <div>
      <DocPageHeader>
        <DocPageTitle>Estimated Occurrences</DocPageTitle>
        <DocPageDescription>
          A task isn't always one-and-done. Estimated Occurrences is the number
          of completions a task needs before it counts as finished.
        </DocPageDescription>
      </DocPageHeader>
      <DocGroup>
        <DocSectionContent>
          <DocSectionTitle>The counter</DocSectionTitle>
          <p>
            Every task has an Estimated Occurrences count — 1 by default. Raise
            it in the task settings under the <b>Schedule panel</b> and the task
            becomes a multi-run task.
          </p>
          <DocSectionImage
            src="/doc/estimated-occurrences.png"
            alt="estimated occurrences field"
          />
          <p>
            Each completion logs one occurrence, and the task shows its progress
            as done / total (for example <b>1 / 31</b>). The task itself is
            marked done only once the counter is full.
          </p>
          <DocCallout tone="info" title="It feeds the goal's progress">
            A goal counts occurrences, not tasks: with one 1-occurrence task and
            one 3-occurrence task, the goal's progress is out of 4.
          </DocCallout>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>Auto estimate from a repeat rule</DocSectionTitle>
          <p>
            You can type the count by hand, but with an active{" "}
            <DocInlineLink to="/doc/concepts/trigger-and-repeat-rule#repeat-rule">
              Repeat Rule
            </DocInlineLink>{" "}
            TSAT fills it for you: the count follows the rule's planned dates
            and re-computes whenever you change the rule or its period.{" "}
            <b>Auto Estimate</b> re-applies the computed value after a manual
            edit, and <b>Preview Dates</b> shows the planned days on a calendar.
          </p>
          <DocSectionImage
            src="/doc/estimated-occurrences-auto.png"
            alt="auto estimate and preview dates"
          />
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>Rules and limits</DocSectionTitle>
          <DocList>
            <li>
              <b>Several times a day is fine</b> — completing a task more than
              once on the same day logs each run as its own item in today's
              list.
            </li>
            <li>
              <b>A repeat rule caps the count</b> — Estimated Occurrences can't
              exceed the number of dates the rule plans.
            </li>
            <li>
              <b>Trigger goals lock it to 1</b> — every task in a trigger goal
              is single-run; the trigger itself brings the whole goal back
              instead.
            </li>
          </DocList>
          <DocCallout tone="tip" title="Prefer automation">
            Logging completions by hand works, but a Repeat Rule or Trigger can
            drive the counter through the daily todo list — see{" "}
            <DocInlineLink to="/doc/concepts/trigger-and-repeat-rule">
              Repeated tasks
            </DocInlineLink>{" "}
            and{" "}
            <DocInlineLink to="/doc/concepts/daily-focus">
              Daily Focus
            </DocInlineLink>
            .
          </DocCallout>
        </DocSectionContent>
      </DocGroup>
    </div>
  )
}

function EstimatedOccurrencesZh() {
  return (
    <div>
      <DocPageHeader>
        <DocPageTitle>预计次数</DocPageTitle>
        <DocPageDescription>
          任务并不总是执行一次就结束。预计次数决定一个任务要执行多少次才算完成。
        </DocPageDescription>
      </DocPageHeader>
      <DocGroup>
        <DocSectionContent>
          <DocSectionTitle>计数器</DocSectionTitle>
          <p>
            每个任务都带有一个预计次数,默认为 1。在任务设置的
            <b>排期面板</b>里将它调高,任务就会变成需要多次执行的任务。
          </p>
          <DocSectionImage
            src="/doc/estimated-occurrences.png"
            alt="estimated occurrences field"
          />
          <p>
            每执行一次记录一次,任务会以「已执行 / 总数」的形式展示进度(例如{" "}
            <b>1 / 31</b>)。只有计数填满,任务本身才算完成。
          </p>
          <DocCallout tone="info" title="它会计入目标进度">
            目标按「次数」而非「任务数」统计进度:一个 1 次的任务加一个 3
            次的任务,目标进度的分母就是 4。
          </DocCallout>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>由重复规则自动估算</DocSectionTitle>
          <p>
            次数可以手动填写;但当任务启用了{" "}
            <DocInlineLink to="/doc/concepts/trigger-and-repeat-rule#repeat-rule">
              重复规则
            </DocInlineLink>
            ,TSAT
            会替你填好:次数跟随规则的计划日期,并在你调整规则或周期时自动重算。手动改过之后,点
            <b>自动估算</b>即可重新套用计算值;<b>预览日期</b>
            则在日历上展示所有计划日。
          </p>
          <DocSectionImage
            src="/doc/estimated-occurrences-auto.png"
            alt="auto estimate and preview dates"
          />
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>规则与限制</DocSectionTitle>
          <DocList>
            <li>
              <b>一天内可以执行多次</b>
              ——同一任务当天执行多次时,每一次都会作为独立条目出现在今日清单里。
            </li>
            <li>
              <b>重复规则会封顶次数</b>
              ——预计次数不能超过规则计划出的日期数。
            </li>
            <li>
              <b>触发器目标会把它锁定为 1</b>
              ——触发器目标下的任务全部是单次任务;把整个目标带回来的是触发器本身。
            </li>
          </DocList>
          <DocCallout tone="tip" title="优先用自动化">
            逐次手动记录执行也可以,但重复规则或触发器能通过每日待办自动驱动这个计数——见{" "}
            <DocInlineLink to="/doc/concepts/trigger-and-repeat-rule">
              重复任务
            </DocInlineLink>{" "}
            与{" "}
            <DocInlineLink to="/doc/concepts/daily-focus">
              每日聚焦
            </DocInlineLink>
            。
          </DocCallout>
        </DocSectionContent>
      </DocGroup>
    </div>
  )
}
