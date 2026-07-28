import {
  DocCallout,
  DocGroup,
  DocInlineLink,
  DocList,
  DocPageDescription,
  DocPageHeader,
  DocPageTitle,
  DocSectionContent,
  DocSectionTitle,
} from "@/components/style/DocStyle"
import { BellElectric, Repeat } from "lucide-react"
import { useLanguage } from "@/components/shared/language-provider"

export function TriggerAndRepeatRule() {
  const { language } = useLanguage()
  return language === "zh" ? (
    <TriggerAndRepeatRuleZh />
  ) : (
    <TriggerAndRepeatRuleEn />
  )
}

function TriggerAndRepeatRuleEn() {
  return (
    <div>
      <DocPageHeader>
        <DocPageTitle>Repeated tasks</DocPageTitle>
        <DocPageDescription>
          Learn how to make a task recur in a workflow — by hand, on a fixed
          schedule, or on a condition.
        </DocPageDescription>
      </DocPageHeader>
      <DocGroup>
        <DocSectionContent>
          <p>
            A task may need several completions before it counts as done — that
            counter is its{" "}
            <DocInlineLink to="/doc/concepts/estimated-occurrences">
              Estimated Occurrences
            </DocInlineLink>
            . You can log those completions by hand, but a <b>Repeat Rule</b> or
            a <b>Trigger</b> can automate them instead.
          </p>
          <DocCallout tone="learn" title="Designed for the daily todo list">
            Repeat Rule and Trigger are two of the mechanisms behind the daily
            todo list. See{" "}
            <DocInlineLink to="/doc/concepts/daily-focus">
              Daily Focus
            </DocInlineLink>{" "}
            to learn the workflow.
          </DocCallout>
        </DocSectionContent>
        <DocSectionContent id="repeat-rule">
          <DocSectionTitle className="flex items-center gap-1">
            <Repeat className="size-5" />
            Repeat Rule
          </DocSectionTitle>
          <p>
            A Repeat Rule schedules a task automatically on a fixed rhythm —
            every N days, or on chosen weekdays — within its active period. Each
            planned date becomes a to-do item when the day arrives. If you miss
            one, it carries over as a debt item to the next day so nothing
            silently disappears. This works best when a task belongs on specific
            dates. Each rule carries its own active period — an explicit start
            and end date you pick when you enable it.
          </p>
          <DocCallout tone="info" title="Occurrences are capped by the rule">
            Your Estimated Occurrences can't exceed the number of planned dates
            the rule produces.
          </DocCallout>
        </DocSectionContent>
        <DocSectionContent id="trigger">
          <DocSectionTitle className="flex items-center gap-1">
            <BellElectric className="size-5" />
            Trigger
          </DocSectionTitle>
          <p>
            A Trigger is looser than a Repeat Rule. It doesn't schedule a task
            on specific dates — it just adds the task to the todo list when its
            condition is met. Whether or not you finish it, it isn't carried
            over to the next day (unless the allow-cross-day option is on). It
            suits a task that isn't tied to specific dates but should show up in
            the list automatically, before its goal is focused.
          </p>
          <p>
            You can also attach a Trigger to a whole goal. In that case all of
            its tasks are reset and added to the todo list when the trigger
            fires.
          </p>
          <DocCallout tone="warning" title="Triggers mean single-run tasks">
            A task with its own trigger — and every task under a trigger goal —
            is limited to a single occurrence. Triggers suit single-run tasks;
            if a task needs several completions, give it a Repeat Rule or a
            plain occurrence count instead.
          </DocCallout>
        </DocSectionContent>
        <DocSectionContent id="vs">
          <DocSectionTitle>RepeatRule vs Trigger</DocSectionTitle>
          <p>
            <b>What they share</b> — on a normal day the planner pulls each of
            them into the todo list only once, as one potential run (repeat-rule
            debt items are the exception). Want several runs in one day? Add the
            task to today again by hand.
          </p>
          <p>
            Where they differ is how strict they are — pick by how much the pace
            matters:
          </p>
          <DocList>
            <li>
              <b>RepeatRule — forced progress alignment.</b> Suited to
              progress-sensitive work. Take the goal "Keeping daily fitness
              workout" with the task "Do 30 minutes elliptical workout", 30 days
              / 30 occurrences: skip Tuesday, and that run follows you as a debt
              item — you catch up by running the task several times in one day.
              A reading plan or exam prep works the same way; the gap to the
              plan is always visible.
            </li>
            <li>
              <b>Trigger — a gentle, non-binding reminder.</b> It just puts
              things back in front of you on schedule. Say a "Weekly workout"
              goal carries a weekly trigger: finish it this week or don't —
              either way, next week the trigger resets the goal and brings it
              back to the list. No debt, nothing piles up.
            </li>
          </DocList>
          <DocCallout tone="tip" title="Mix and match">
            There's no single right answer — explore your own combinations:
            repeat rules for the hard commitments, triggers for the flexible
            habits.
          </DocCallout>
        </DocSectionContent>
      </DocGroup>
    </div>
  )
}

function TriggerAndRepeatRuleZh() {
  return (
    <div>
      <DocPageHeader>
        <DocPageTitle>重复任务</DocPageTitle>
        <DocPageDescription>
          了解如何让任务在工作流中反复出现——手动完成、按固定节奏,或按条件触发。
        </DocPageDescription>
      </DocPageHeader>
      <DocGroup>
        <DocSectionContent>
          <p>
            一个任务可能需要执行多次才算完成——这个计数就是它的{" "}
            <DocInlineLink to="/doc/concepts/estimated-occurrences">
              预计次数
            </DocInlineLink>
            。你可以手动逐次记录执行,但<b>重复规则</b>和<b>触发器</b>
            可以替你自动做这件事。
          </p>
          <DocCallout tone="learn" title="为每日待办而设计">
            重复规则与触发器是每日待办清单背后的两个机制。见{" "}
            <DocInlineLink to="/doc/concepts/daily-focus">
              每日聚焦
            </DocInlineLink>{" "}
            了解完整工作流。
          </DocCallout>
        </DocSectionContent>
        <DocSectionContent id="repeat-rule">
          <DocSectionTitle className="flex items-center gap-1">
            <Repeat className="size-5" />
            重复规则
          </DocSectionTitle>
          <p>
            重复规则按固定节奏自动为任务排期——每 N
            天一次,或在选定的星期几——且只在其有效周期内生效。每个计划日到来时都会生成一条待办;错过的那一天会作为欠账项顺延到次日,不会悄悄消失。它最适合必须落在特定日期的任务。每条规则都带有各自的有效周期——即启用时选定的明确起止日期。
          </p>
          <DocCallout tone="info" title="次数受规则封顶">
            预计次数不能超过规则计划出的日期数量。
          </DocCallout>
        </DocSectionContent>
        <DocSectionContent id="trigger">
          <DocSectionTitle className="flex items-center gap-1">
            <BellElectric className="size-5" />
            触发器
          </DocSectionTitle>
          <p>
            触发器比重复规则更松散。它不为任务安排具体日期——只在条件满足时把任务放进待办清单。无论当天是否执行,它都不会顺延到次日(除非开启了允许跨天)。它适合那些不绑定具体日期、但你希望在目标被聚焦之前就自动出现在清单里的任务。
          </p>
          <p>
            触发器也可以绑定在整个目标上:触发时,目标下的所有任务都会被重置并加入待办清单。
          </p>
          <DocCallout tone="warning" title="触发器意味着单次任务">
            任务自带触发器,或处于触发器目标之下,都会被限制为单次执行。触发器适合单次任务;如果任务需要多次完成,请改用重复规则或普通的预计次数。
          </DocCallout>
        </DocSectionContent>
        <DocSectionContent id="vs">
          <DocSectionTitle>重复规则 vs 触发器</DocSectionTitle>
          <p>
            <b>共同点</b>
            ——正常情况下,自动规划器每天只会把它们拉入待办清单一次,作为一次潜在的执行(重复规则的欠账项是例外)。如果想在一天内执行多次,需手动把任务再次加入当天。
          </p>
          <p>差异在于约束力的强弱——按你对进度的重视程度来选:</p>
          <DocList>
            <li>
              <b>重复规则:强制的进度对齐。</b>
              适合对进度敏感的任务。比如目标「保持每日健身」下的任务「做 30
              分钟椭圆机训练」,30 天 30
              次:周二没做,那一次就会变成欠账项一直跟着你——后续需要靠一天多次执行把进度追回来。读书计划、备考刷题同理,与计划的差距始终清晰可见。
            </li>
            <li>
              <b>触发器:非强制的温和提醒。</b>
              它只负责按节奏把事情重新放回你眼前。比如目标「每周锻炼」绑定一个每周触发器:这周做不做都可以——无论如何,下周触发器都会重置目标、把它带回清单。不产生欠账,也不会堆积。
            </li>
          </DocList>
          <DocCallout tone="tip" title="自由组合">
            这里没有标准答案——按自己的节奏尝试不同的搭配:硬性承诺交给重复规则,弹性习惯交给触发器。
          </DocCallout>
        </DocSectionContent>
      </DocGroup>
    </div>
  )
}
