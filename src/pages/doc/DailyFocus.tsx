import {
  DocGroup,
  DocPageDescription,
  DocPageHeader,
  DocPageTitle,
  DocSectionContent,
  DocSectionImage,
  DocSectionTitle,
} from "@/components/style/DocStyle"
import { useLanguage } from "@/components/shared/language-provider"

export function DailyFocus() {
  const { language } = useLanguage()
  return language === "zh" ? <DailyFocusZh /> : <DailyFocusEn />
}

function DailyFocusEn() {
  return (
    <div>
      <DocPageHeader>
        <DocPageTitle>Daily Focus</DocPageTitle>
        <DocPageDescription>
          Your goals hold everything you intend to do and Daily Focus is what
          you're actually doing today — and how each task moves from queued to
          finished.
        </DocPageDescription>
      </DocPageHeader>

      <DocGroup>
        <DocSectionContent>
          <DocSectionTitle>Daily Todo List</DocSectionTitle>
          <p>
            You don't have to maintain a daily todo list by hand. Your goals
            hold everything you intend to do. Daily Focus is what you're actually
            doing today — and how each task moves from queued to finished.
          </p>
          <p>
            A task only enters today's list when something puts it there. There
            are two kinds of reasons.
          </p>
          <p>
            <b>You asked for it</b> — you added the task to today by hand, or
            you focused its goal. These stay: the planner never silently removes
            what you chose.
          </p>
          <p>
            <b>A rule brought it</b> — the task (or its goal) is due soon, a
            repeat rule planned it for today, or a trigger fired. These are
            forced and you can't exclude them from today.
          </p>
          <p>
            In addition, if there's still space in your daily capacity, TSAT
            auto-fills the next unfinished task from each focused goal.
          </p>
          <DocSectionImage src="/doc/daily-focus.svg" alt="daily focus" />
        </DocSectionContent>
        <DocSectionContent>
          <DocSectionTitle>Three States SOP</DocSectionTitle>
          <p>
            Every item on today's list sits in one of three states, and you move
            it along as you work.
          </p>
          <p>
            <b>Todo —</b> the task is in todo list, but you haven't started it
            yet.
          </p>
          <p>
            <b>In Progress —</b> you're working on it.
          </p>
          <p>
            <b>Done —</b> you finished it. This is the only transition that
            records anything: it writes a completion and advances the task's
            (and its goal's) progress.
          </p>
          <p>
            You can move backwards at any time — Undo returns a done item to
            todo and retracts that completion, so your counts stay aligned.
          </p>
          <DocSectionImage src="/doc/task-lifecycle.svg" alt="task life" />
        </DocSectionContent>
        <DocSectionContent>
          <DocSectionTitle>Example</DocSectionTitle>
          <p>
            Let's reuse the case of <b>"Do 30 minutes elliptical workout"</b>.
            When the task is in your Daily Focus list, the item looks like
            this:
          </p>
          <DocSectionImage src="/doc/sop-1.png" alt="sop-1" />
          <p>
            Then you can click the <b>Start</b> button to move it to In Progress
            state.
          </p>
          <DocSectionImage src="/doc/sop-2.png" alt="sop-2" />
          <p>
            By clicking the checkbox, you mark it as done. Then go to the task
            detail page, and you can see this task has been marked as done today.
            But it's still incomplete since it has 31 estimated occurrences, and
            the progress is now updated to 1/31.
          </p>
          <DocSectionImage src="/doc/sop-3.png" alt="sop-3" />
        </DocSectionContent>
      </DocGroup>
    </div>
  )
}

function DailyFocusZh() {
  return (
    <div>
      <DocPageHeader>
        <DocPageTitle>每日聚焦</DocPageTitle>
        <DocPageDescription>
          目标承载了你打算做的一切,而每日聚焦是你今天实际在做的事——以及每个任务如何从排队走到完成。
        </DocPageDescription>
      </DocPageHeader>

      <DocGroup>
        <DocSectionContent>
          <DocSectionTitle>每日待办清单</DocSectionTitle>
          <p>
            你不需要手动维护每日待办。目标里已经装下了你打算做的一切;每日聚焦呈现的是你今天实际要做的事,以及每个任务如何从排队走到完成。
          </p>
          <p>任务只有被某种原因放进来时,才会进入今日清单。原因分两类。</p>
          <p>
            <b>你主动要的</b>
            ——你手动把任务加进了今天,或者聚焦了它的目标。这类条目会一直保留:规划器绝不会悄悄移除你自己的选择。
          </p>
          <p>
            <b>规则带来的</b>
            ——任务(或其目标)临近截止、重复规则把它排在了今天,或者触发器触发了。这类是强制的,无法从今天排除。
          </p>
          <p>
            此外,如果当日容量仍有富余,TSAT
            会从每个已聚焦的目标中自动补入下一个未完成任务。
          </p>
          <DocSectionImage src="/doc/daily-focus.svg" alt="daily focus" />
        </DocSectionContent>
        <DocSectionContent>
          <DocSectionTitle>三状态流转</DocSectionTitle>
          <p>
            今日清单上的每个条目都处于三种状态之一,你在做事的过程中推动它前进。
          </p>
          <p>
            <b>待办</b>——任务在清单里,但你还没开始。
          </p>
          <p>
            <b>进行中</b>——你正在做。
          </p>
          <p>
            <b>已完成</b>
            ——你做完了。这是唯一会留下记录的流转:记录一次执行,并推进任务(及其目标)的进度。
          </p>
          <p>
            任何时候都可以回退——撤销会把已完成条目退回待办,并收回那次执行记录,计数始终保持一致。
          </p>
          <DocSectionImage src="/doc/task-lifecycle.svg" alt="task life" />
        </DocSectionContent>
        <DocSectionContent>
          <DocSectionTitle>示例</DocSectionTitle>
          <p>
            继续用<b>「做 30 分钟椭圆机训练」</b>
            这个例子。当它出现在你的每日聚焦清单里时,条目显示如下:
          </p>
          <DocSectionImage src="/doc/sop-1.png" alt="sop-1" />
          <p>
            点击<b>开始</b>按钮,把它推进到进行中状态。
          </p>
          <DocSectionImage src="/doc/sop-2.png" alt="sop-2" />
          <p>
            勾选复选框即标记完成。回到任务详情页可以看到:任务今天已执行过一次,但由于预计次数是
            31,它整体仍未完成——进度更新为 1/31。
          </p>
          <DocSectionImage src="/doc/sop-3.png" alt="sop-3" />
        </DocSectionContent>
      </DocGroup>
    </div>
  )
}
