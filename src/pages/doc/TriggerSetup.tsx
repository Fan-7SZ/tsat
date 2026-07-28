import {
  DocCallout,
  DocGroup,
  DocItem,
  DocItemContent,
  DocItemDescription,
  DocItemTitle,
  DocInlineLink,
  DocPageDescription,
  DocPageHeader,
  DocPageTitle,
  DocSectionContent,
  DocSectionImage,
  DocSectionTitle,
} from "@/components/style/DocStyle"
import { useLanguage } from "@/components/shared/language-provider"

export function TriggerSetup() {
  const { language } = useLanguage()
  return language === "zh" ? <TriggerSetupZh /> : <TriggerSetupEn />
}

function TriggerSetupEn() {
  return (
    <div>
      <DocPageHeader>
        <DocPageTitle>Set a Trigger</DocPageTitle>
        <DocPageDescription>
          A trigger drops a task (or a whole goal) into today's list on its own
          when a condition is met — no fixed calendar dates, no carry-over. This
          guide walks through setting one up.
        </DocPageDescription>
      </DocPageHeader>
      <DocGroup>
        <DocSectionContent>
          <p>
            A trigger is the looser sibling of a repeat rule: instead of
            planning specific dates, it just adds the task to your todo list
            whenever it fires. If you only need the concept, read{" "}
            <DocInlineLink to="/doc/concepts/trigger-and-repeat-rule#trigger">
              Trigger
            </DocInlineLink>{" "}
            first. Here we focus on the setup.
          </p>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>Task trigger or goal trigger</DocSectionTitle>
          <p>
            Triggers live at two levels. Pick the one that matches what should
            come back.
          </p>
          <DocItem>
            <DocItemContent>
              <DocItemTitle>Task trigger</DocItemTitle>
              <DocItemDescription>
                Brings a single task into today when it fires. Set on a task's{" "}
                <b>Schedule</b> panel or in the Create Task dialog. The task
                must belong to a goal that isn't itself triggered.
              </DocItemDescription>
            </DocItemContent>
          </DocItem>
          <DocItem>
            <DocItemContent>
              <DocItemTitle>Goal trigger</DocItemTitle>
              <DocItemDescription>
                Resets the whole goal and brings all of its tasks back when it
                fires. Set on the goal's <b>Details → Schedule</b> section or in
                the Create Goal dialog.
              </DocItemDescription>
            </DocItemContent>
          </DocItem>
        </DocSectionContent>

        <DocSectionContent id="task-trigger">
          <DocSectionTitle>Set up a task trigger</DocSectionTitle>
          <p>
            Open the task and find the <b>Schedule</b> panel. Turn on the{" "}
            <b>Trigger</b> card — the mode and its fields expand below.
          </p>
          <DocSectionImage
            src="/doc/trigger-sectioncard.png"
            alt="trigger card in the schedule panel"
          />
          <DocCallout tone="warning" title="Trigger clears Due date and Repeat">
            Trigger, Repeat and a fixed Due date are mutually exclusive.
            Enabling the trigger switches off the Repeat card and removes the
            task's due date, so the trigger is the single thing scheduling it.
          </DocCallout>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>Choose a mode</DocSectionTitle>
          <p>
            Once the card is on, pick one of the four modes from the select —
            the fields below change with it:
          </p>
          <DocSectionImage
            src="/doc/trigger-sectioncard2.png"
            alt="trigger card with mode select and fields"
          />
          <DocItem>
            <DocItemContent>
              <DocItemTitle>Daily</DocItemTitle>
              <DocItemDescription>
                Fires every N days. Set <b>Repeat every</b> to 1 for every day,
                2 for every other day, and so on.
              </DocItemDescription>
            </DocItemContent>
          </DocItem>
          <DocItem>
            <DocItemContent>
              <DocItemTitle>Weekly</DocItemTitle>
              <DocItemDescription>
                Fires on the weekdays you pick under <b>Days of week</b>, and
                you can space it out with <b>Every n weeks</b>.
              </DocItemDescription>
            </DocItemContent>
          </DocItem>
          <DocItem>
            <DocItemContent>
              <DocItemTitle>Monthly</DocItemTitle>
              <DocItemDescription>
                Fires once a month on the day you pick under{" "}
                <b>Day of month</b>. When a month is shorter than the chosen
                day (say day 31 in February), it fires on that month's last
                day instead of skipping.
              </DocItemDescription>
            </DocItemContent>
          </DocItem>
          <DocItem>
            <DocItemContent>
              <DocItemTitle>Custom</DocItemTitle>
              <DocItemDescription>
                Fires on the exact calendar dates you select under{" "}
                <b>Custom dates</b>. Use this for an irregular schedule.
              </DocItemDescription>
            </DocItemContent>
          </DocItem>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>Set the trigger period</DocSectionTitle>
          <p>
            Daily, weekly and monthly task triggers take an optional{" "}
            <b>Trigger period</b> — the window in which they're allowed to fire.
            Its start also anchors the interval math. Leave it unset and the
            trigger simply runs from the task's creation date.
          </p>
          <DocCallout tone="info" title="Custom mode has no period">
            Custom triggers already fire on explicit dates, so the period field
            disappears when you switch to Custom — the dates you pick are the
            whole schedule.
          </DocCallout>
        </DocSectionContent>

        <DocSectionContent id="goal-trigger">
          <DocSectionTitle>Set up a goal trigger</DocSectionTitle>
          <p>
            On the goal's <b>Details</b> tab, open the <b>Schedule</b> section
            and turn on its <b>Trigger</b> card. Goal triggers use the same
            four modes, but have <b>no validity window</b> and are mutually
            exclusive with the goal's duration and due date.
          </p>
          <DocSectionImage
            src="/doc/goal-trigger-sectioncard.png"
            alt="goal trigger card — no trigger period field"
          />
          <DocCallout
            tone="danger"
            title="A goal trigger forces its tasks to single-run"
          >
            Turning it on resets every task in the goal to a single completion
            and deletes their repeat / trigger rules. If any task has a planned
            count other than 1, TSAT asks you to confirm before overwriting.
          </DocCallout>
          <p>
            Goal triggers also have a <b>Set a due date on reset</b> toggle.
            When on, each reset stamps the goal with a due of 23:59 the day
            before the next fire — so a daily trigger is due the same evening,
            and a monthly one gives you until the day before next month's
            reset. Turn it off and resets carry no due date at all.
          </p>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>Example</DocSectionTitle>
          <p>
            Let's say you have a goal "Keep the home tidy" and a task{" "}
            <b>"Water the plants"</b> that isn't tied to specific dates — you
            just want it to come back regularly.
          </p>
          <p>
            In the task's Schedule panel, turn on <b>Trigger</b>, choose{" "}
            <b>Weekly</b>, tick <b>Mon</b> and <b>Wed</b>, and Save. Notice what
            the panel now shows: the due date is gone and the Repeat card is
            locked — the trigger is the only thing scheduling this task.
          </p>
          <DocSectionImage
            src="/doc/weekly-trigger-example.png"
            alt="schedule panel with a weekly trigger on Monday and Wednesday"
          />
          <p>
            Then on every ticked day — say a Wednesday — the trigger fires and
            quietly drops the task into your daily focus list. There are no
            planned calendar dates behind it, and if you don't finish it, it
            simply comes back on the next ticked day instead of piling up as
            debt.
          </p>
          <DocSectionImage
            src="/doc/trigger-fired-sample.png"
            alt="task pulled into today's list by its trigger"
          />
        </DocSectionContent>
      </DocGroup>
    </div>
  )
}

function TriggerSetupZh() {
  return (
    <div>
      <DocPageHeader>
        <DocPageTitle>设置触发器</DocPageTitle>
        <DocPageDescription>
          触发器在条件满足时,自动把任务(或整个目标)放进今日清单——没有固定日历日期,也不顺延。本指南带你完成设置。
        </DocPageDescription>
      </DocPageHeader>
      <DocGroup>
        <DocSectionContent>
          <p>
            触发器是重复规则更松散的姊妹机制:它不排具体日期,只在触发时把任务加进待办清单。如果你想先了解概念,请先读{" "}
            <DocInlineLink to="/doc/concepts/trigger-and-repeat-rule#trigger">
              触发器
            </DocInlineLink>
            ;这里专注于设置。
          </p>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>任务触发器还是目标触发器</DocSectionTitle>
          <p>触发器有两个层级。根据「你想让什么回来」来选择。</p>
          <DocItem>
            <DocItemContent>
              <DocItemTitle>任务触发器</DocItemTitle>
              <DocItemDescription>
                触发时把单个任务带进今天。在任务的<b>排期</b>
                面板或创建任务对话框里设置。任务所属的目标本身不能设有触发器。
              </DocItemDescription>
            </DocItemContent>
          </DocItem>
          <DocItem>
            <DocItemContent>
              <DocItemTitle>目标触发器</DocItemTitle>
              <DocItemDescription>
                触发时重置整个目标,把它的所有任务都带回来。在目标的
                <b>详情 → 排期</b>区或创建目标对话框里设置。
              </DocItemDescription>
            </DocItemContent>
          </DocItem>
        </DocSectionContent>

        <DocSectionContent id="task-trigger">
          <DocSectionTitle>设置任务触发器</DocSectionTitle>
          <p>
            打开任务,找到<b>排期</b>面板。打开<b>触发器</b>
            卡片——模式与对应字段会在下方展开。
          </p>
          <DocSectionImage
            src="/doc/trigger-sectioncard.png"
            alt="trigger card in the schedule panel"
          />
          <DocCallout tone="warning" title="触发器会清空截止日期与重复">
            触发器、重复、固定截止日期三者互斥。开启触发器会关闭重复卡片并移除任务的截止日期——此后调度这个任务的只有触发器。
          </DocCallout>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>选择模式</DocSectionTitle>
          <p>卡片开启后,从下拉框选择四种模式之一——下方字段会随之变化:</p>
          <DocSectionImage
            src="/doc/trigger-sectioncard2.png"
            alt="trigger card with mode select and fields"
          />
          <DocItem>
            <DocItemContent>
              <DocItemTitle>每天</DocItemTitle>
              <DocItemDescription>
                每 N 天触发一次。<b>重复间隔</b>填 1 表示每天,填 2
                表示隔天,依此类推。
              </DocItemDescription>
            </DocItemContent>
          </DocItem>
          <DocItem>
            <DocItemContent>
              <DocItemTitle>每周</DocItemTitle>
              <DocItemDescription>
                在<b>星期</b>里勾选的日子触发,还可以用<b>每 N 周</b>
                拉开触发间隔。
              </DocItemDescription>
            </DocItemContent>
          </DocItem>
          <DocItem>
            <DocItemContent>
              <DocItemTitle>每月</DocItemTitle>
              <DocItemDescription>
                每月在<b>每月几号</b>选定的那天触发一次。当月天数不足时(比如
                2 月没有 31 号),会改为在当月最后一天触发,不会跳过。
              </DocItemDescription>
            </DocItemContent>
          </DocItem>
          <DocItem>
            <DocItemContent>
              <DocItemTitle>自定义</DocItemTitle>
              <DocItemDescription>
                在<b>自定义日期</b>
                里选定的具体日历日触发。适合不规律的安排。
              </DocItemDescription>
            </DocItemContent>
          </DocItem>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>设置触发器有效期</DocSectionTitle>
          <p>
            每天 / 每周 / 每月模式的任务触发器可以选填<b>触发器有效期</b>
            ——允许它触发的时间窗,起点同时也是间隔计算的锚点。留空则从任务创建日起一直生效。
          </p>
          <DocCallout tone="info" title="自定义模式没有有效期">
            自定义触发器本来就按明确日期触发,切到自定义后有效期字段会消失——你选的日期就是全部安排。
          </DocCallout>
        </DocSectionContent>

        <DocSectionContent id="goal-trigger">
          <DocSectionTitle>设置目标触发器</DocSectionTitle>
          <p>
            在目标的<b>详情</b>页打开<b>排期</b>区,开启它的<b>触发器</b>
            卡片。目标触发器使用同样的四种模式,但<b>没有有效期</b>
            ,并且与目标的时长和截止日期互斥。
          </p>
          <DocSectionImage
            src="/doc/goal-trigger-sectioncard.png"
            alt="goal trigger card — no trigger period field"
          />
          <DocCallout tone="danger" title="目标触发器会把任务全部变为单次">
            开启后,目标下的每个任务都会被重置为单次执行,其重复 /
            触发器规则会被删除。如果有任务的预计次数不为 1,TSAT
            会先弹确认再覆盖。
          </DocCallout>
          <p>
            目标触发器还提供<b>重置时设置截止时间</b>
            开关。开启后,每次重置会给目标盖上一个截止时间:下次触发前一天的
            23:59——每天触发即当晚到期,每月触发则可以做到下月重置的前一天。关闭后,重置不再带任何截止时间。
          </p>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>示例</DocSectionTitle>
          <p>
            假设你有目标「保持家里整洁」和任务<b>「给植物浇水」</b>
            ——它不绑定具体日期,你只希望它定期回来。
          </p>
          <p>
            在任务的排期面板开启<b>触发器</b>,选<b>每周</b>,勾选<b>周一</b>和
            <b>周三</b>
            ,保存。注意此时面板的变化:截止日期消失了,重复卡片也被锁定——现在调度这个任务的只有触发器。
          </p>
          <DocSectionImage
            src="/doc/weekly-trigger-example.png"
            alt="schedule panel with a weekly trigger on Monday and Wednesday"
          />
          <p>
            之后每逢勾选的日子——比如某个周三——触发器就会触发,把任务自动放进你的每日聚焦清单。它背后没有排好的日历计划;没做完也不会堆积成欠账,下个勾选日它自然会再回来。
          </p>
          <DocSectionImage
            src="/doc/trigger-fired-sample.png"
            alt="task pulled into today's list by its trigger"
          />
        </DocSectionContent>
      </DocGroup>
    </div>
  )
}
