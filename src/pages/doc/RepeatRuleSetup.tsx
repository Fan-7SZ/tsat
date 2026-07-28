import {
  DocPageHeader,
  DocPageTitle,
  DocPageDescription,
  DocGroup,
  DocSectionContent,
  DocSectionTitle,
  DocSectionImage,
  DocCallout,
  DocList,
} from "@/components/style/DocStyle"
import { Repeat } from "lucide-react"
import { useLanguage } from "@/components/shared/language-provider"

export function RepeatRuleSetup() {
  const { language } = useLanguage()
  return language === "zh" ? <RepeatRuleSetupZh /> : <RepeatRuleSetupEn />
}

function RepeatRuleSetupEn() {
  return (
    <div>
      <DocPageHeader>
        <DocPageTitle>Repeat Rule Setup</DocPageTitle>
        <DocPageDescription>
          Learn how to set up a repeat rule for a task in TSAT.
        </DocPageDescription>
      </DocPageHeader>
      <DocGroup>
        <DocSectionContent>
          <p>
            A Repeat Rule puts a task on a fixed schedule automatically, so each
            planned date turns into a to-do item when the day arrives. You
            can set one up in two places: the <b>Create Task</b> dialog, or the{" "}
            <b>Schedule panel</b> of an existing task's detail page.
          </p>
          <DocSectionImage
            src="/doc/repeat-rule-sectioncard.png"
            alt="repeat rule setup"
          />
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle className="flex items-center gap-1">
            <Repeat className="size-5" />
            Enable the rule
          </DocSectionTitle>
          <p>
            In the Schedule panel, turn on the <b>Repeat</b> card. Repeat and{" "}
            <b>Trigger</b> are mutually exclusive, so enabling one disables the
            other — pick Repeat when the task belongs on specific dates.
          </p>
        </DocSectionContent>
        <DocSectionContent>
          <p>In the section card, there are two modes: Daily and Weekly.</p>
          <DocSectionImage
            src="/doc/repeat-rule-sectioncard2.png"
            alt="repeat rule modes"
          />
        </DocSectionContent>
        <DocSectionContent>
          <DocSectionTitle>Choose a mode</DocSectionTitle>
          <DocList>
            <li>
              <b>Daily</b> — repeats every N days. Set the interval to 1 for
              every day, 2 for every other day, and so on.
            </li>
            <li>
              <b>Weekly</b> — repeats on the weekdays you pick (e.g. Mon / Wed /
              Fri), and you can space it out to every N weeks.
            </li>
          </DocList>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>Set the active period</DocSectionTitle>
          <p>
            The rule only plans dates inside its active period, and the period
            is <b>required</b> — pick an explicit start and end date when you
            enable the rule.
          </p>
        </DocSectionContent>
        <DocSectionContent>
          <DocSectionTitle>Example</DocSectionTitle>
          <p>
            Let's say you have a goal "Keep a daily fitness habit" and a task "Do
            a 30-minute elliptical workout". You want to do this task every day
            for 30 days, so you set a repeat rule for it.
          </p>

          <p>
            In the panel, you set the mode to <b>Daily</b>, the interval to{" "}
            <b>1</b>, and the active period from <b>2026-07-21</b> to{" "}
            <b>2026-08-20</b>. This means the task is scheduled every day from
            July 21st to August 20th, and each day a new to-do item shows up in
            your Daily Focus list for you to complete.
          </p>
          <DocSectionImage
            src="/doc/one-month-repeat-rule.png"
            alt="repeat rule example"
          />
          <p>
            If today falls within the active period, open your Daily Focus list
            and you'll see the task already scheduled for today.
          </p>
          <DocSectionImage
            src="/doc/daily-focus-sample.png"
            alt="repeat rule example"
          />
          <DocCallout tone="tip" title="Preview the plan">
            Check the <b>Planning Pressure</b> panel to avoid stacking too many
            planned tasks on a single day.
          </DocCallout>
        </DocSectionContent>
      </DocGroup>
    </div>
  )
}

function RepeatRuleSetupZh() {
  return (
    <div>
      <DocPageHeader>
        <DocPageTitle>设置重复规则</DocPageTitle>
        <DocPageDescription>
          了解如何在 TSAT 中为任务设置重复规则。
        </DocPageDescription>
      </DocPageHeader>
      <DocGroup>
        <DocSectionContent>
          <p>
            重复规则会按固定节奏自动为任务排期,每个计划日到来时都会生成一条待办。它有两个设置入口:
            <b>创建任务</b>对话框,或已有任务详情页的<b>排期面板</b>。
          </p>
          <DocSectionImage
            src="/doc/repeat-rule-sectioncard.png"
            alt="repeat rule setup"
          />
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle className="flex items-center gap-1">
            <Repeat className="size-5" />
            启用规则
          </DocSectionTitle>
          <p>
            在排期面板里打开<b>重复</b>卡片。重复与<b>触发器</b>
            互斥,开启一个会禁用另一个——当任务必须落在特定日期时,应选择重复。
          </p>
        </DocSectionContent>
        <DocSectionContent>
          <p>卡片里有两种模式:每天和每周。</p>
          <DocSectionImage
            src="/doc/repeat-rule-sectioncard2.png"
            alt="repeat rule modes"
          />
        </DocSectionContent>
        <DocSectionContent>
          <DocSectionTitle>选择模式</DocSectionTitle>
          <DocList>
            <li>
              <b>每天</b>——每 N 天重复一次。间隔填 1 表示每天,填 2
              表示隔天,依此类推。
            </li>
            <li>
              <b>每周</b>——在你勾选的星期几重复(如周一 / 周三 /
              周五),也可以拉长到每 N 周一次。
            </li>
          </DocList>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>设置重复周期</DocSectionTitle>
          <p>
            规则只在其周期内计划日期,且周期是<b>必填</b>
            的——启用规则时需选定明确的起止日期。
          </p>
        </DocSectionContent>
        <DocSectionContent>
          <DocSectionTitle>示例</DocSectionTitle>
          <p>
            假设你有目标「保持每日健身」和任务「做 30 分钟椭圆机训练」,想连续 30
            天每天做一次,于是为这个任务设置重复规则。
          </p>

          <p>
            在面板里把模式设为<b>每天</b>、间隔设为 <b>1</b>、周期设为{" "}
            <b>2026-07-21</b> 到 <b>2026-08-20</b>。这样从 7 月 21 日到 8 月 20
            日,任务每天都会被排期,每天在你的每日聚焦清单里生成一条新的待办等你完成。
          </p>
          <DocSectionImage
            src="/doc/one-month-repeat-rule.png"
            alt="repeat rule example"
          />
          <p>
            只要今天落在周期内,打开每日聚焦清单,即可看到任务已经排入今天。
          </p>
          <DocSectionImage
            src="/doc/daily-focus-sample.png"
            alt="repeat rule example"
          />
          <DocCallout tone="tip" title="预览计划">
            记得看看<b>规划压力</b>面板,避免把太多计划任务堆在同一天。
          </DocCallout>
        </DocSectionContent>
      </DocGroup>
    </div>
  )
}
