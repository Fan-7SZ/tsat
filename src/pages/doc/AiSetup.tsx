import {
  DocGroup,
  DocItem,
  DocItemContent,
  DocItemDescription,
  DocItemTitle,
  DocCallout,
  DocList,
  DocPageDescription,
  DocPageHeader,
  DocPageTitle,
  DocSectionContent,
  DocSectionImage,
  DocSectionTitle,
} from "@/components/style/DocStyle"
import { ListPlus, Sparkles, Workflow } from "lucide-react"
import { useLanguage } from "@/components/shared/language-provider"

export function AiSetup() {
  const { language } = useLanguage()
  return language === "zh" ? <AiSetupZh /> : <AiSetupEn />
}

function AiSetupEn() {
  return (
    <div>
      <DocPageHeader>
        <DocPageTitle>AI Setup</DocPageTitle>
        <DocPageDescription>
          TSAT can use an AI model to draft task steps, break a goal into tasks,
          and tidy up dependencies. It is entirely optional — nothing calls the
          AI until you connect a provider.
        </DocPageDescription>
      </DocPageHeader>
      <DocGroup>
        <DocSectionContent>
          <DocSectionTitle>Connect a provider</DocSectionTitle>
          <p>
            Open <b>Settings → AI</b>. Pick a provider, paste its API key, and
            you are done — the assistant is ready wherever it appears. Nothing is
            sent anywhere until you press one of the AI buttons.
          </p>
          <DocSectionImage src="/doc/ai-settings.png" alt="AI settings panel" />
          <DocList>
            <li>
              <b>OpenRouter</b> — get a key from openrouter.ai. One key gives you
              many models; set the <b>Model</b> field to an identifier like{" "}
              <b>openai/gpt-4o-mini</b>.
            </li>
            <li>
              <b>DeepSeek</b> — get a key from platform.deepseek.com. The
              default model <b>deepseek-v4-flash</b> works out of the box.
            </li>
          </DocList>
          <DocCallout tone="info" title="Your key stays on this device">
            The API key is saved in your browser's local storage and sent only
            to the provider you picked. It never passes through a TSAT server.
          </DocCallout>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>AI Assist</DocSectionTitle>
          <DocSectionImage
            src="/doc/ai-entry-points.png"
            alt="the three AI entry points"
          />
          <DocItem>
            <DocItemContent>
              <DocItemTitle>
                <Sparkles className="size-5 shrink-0 text-violet-700 dark:text-violet-400" />
                Autofill steps
              </DocItemTitle>
              <DocItemDescription>
                Turns a task title into a ready-to-use checklist of steps.
              </DocItemDescription>
            </DocItemContent>
          </DocItem>
          <DocItem>
            <DocItemContent>
              <DocItemTitle>
                <ListPlus className="size-5 shrink-0 text-violet-700 dark:text-violet-400" />
                Break down into tasks
              </DocItemTitle>
              <DocItemDescription>
                Splits a goal into a set of new tasks, giving you a task list to
                build on.
              </DocItemDescription>
            </DocItemContent>
          </DocItem>
          <DocItem>
            <DocItemContent>
              <DocItemTitle>
                <Workflow className="size-5 shrink-0 text-violet-700 dark:text-violet-400" />
                Optimize dependencies
              </DocItemTitle>
              <DocItemDescription>
                Reorders the dependencies between a goal's tasks into a clearer
                execution path.
              </DocItemDescription>
            </DocItemContent>
          </DocItem>
        </DocSectionContent>
      </DocGroup>
    </div>
  )
}

function AiSetupZh() {
  return (
    <div>
      <DocPageHeader>
        <DocPageTitle>AI 设置</DocPageTitle>
        <DocPageDescription>
          TSAT 可以借助 AI
          模型草拟任务步骤、把目标拆解成任务、整理依赖关系。它完全可选——在你连接服务商之前,不会有任何
          AI 调用。
        </DocPageDescription>
      </DocPageHeader>
      <DocGroup>
        <DocSectionContent>
          <DocSectionTitle>连接服务商</DocSectionTitle>
          <p>
            打开<b>设置 → AI</b>。选择一个服务商,粘贴它的 API
            密钥,即可完成——助手会在所有用到它的地方随时可用。在你按下某个 AI
            按钮之前,不会有任何数据被发送。
          </p>
          <DocSectionImage src="/doc/ai-settings.png" alt="AI settings panel" />
          <DocList>
            <li>
              <b>OpenRouter</b>——在 openrouter.ai
              获取密钥。一个密钥即可访问多种模型;把<b>模型</b>字段填成{" "}
              <b>openai/gpt-4o-mini</b> 这样的标识符。
            </li>
            <li>
              <b>DeepSeek</b>——在 platform.deepseek.com 获取密钥。默认模型{" "}
              <b>deepseek-v4-flash</b> 开箱即用。
            </li>
          </DocList>
          <DocCallout tone="info" title="密钥只留在这台设备">
            API 密钥保存在浏览器本地存储,只会发送给你选择的服务商,绝不经过 TSAT
            的服务器。
          </DocCallout>
        </DocSectionContent>

        <DocSectionContent>
          <DocSectionTitle>AI 辅助</DocSectionTitle>
          <DocSectionImage
            src="/doc/ai-entry-points.png"
            alt="the three AI entry points"
          />
          <DocItem>
            <DocItemContent>
              <DocItemTitle>
                <Sparkles className="size-5 shrink-0 text-violet-700 dark:text-violet-400" />
                AI 补全步骤
              </DocItemTitle>
              <DocItemDescription>
                根据任务标题,自动生成一份可执行的步骤清单。
              </DocItemDescription>
            </DocItemContent>
          </DocItem>
          <DocItem>
            <DocItemContent>
              <DocItemTitle>
                <ListPlus className="size-5 shrink-0 text-violet-700 dark:text-violet-400" />
                AI 拆分任务
              </DocItemTitle>
              <DocItemDescription>
                把一个目标拆解成若干个新任务,快速搭起任务列表。
              </DocItemDescription>
            </DocItemContent>
          </DocItem>
          <DocItem>
            <DocItemContent>
              <DocItemTitle>
                <Workflow className="size-5 shrink-0 text-violet-700 dark:text-violet-400" />
                AI 优化依赖
              </DocItemTitle>
              <DocItemDescription>
                重新梳理目标下任务之间的依赖关系,给出更合理的执行顺序。
              </DocItemDescription>
            </DocItemContent>
          </DocItem>
        </DocSectionContent>
      </DocGroup>
    </div>
  )
}
