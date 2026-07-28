import { useAppStore } from "@/store/app-store"
import {
  useLanguage,
  type Language,
} from "@/components/shared/language-provider"
import { useTheme } from "@/components/shared/theme-provider"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DurationInput } from "@/components/shared/DurationInput"
import { SyncSettings } from "@/components/dialogs/SyncDialog"
import {
  SettingField,
  SettingFieldTitle,
  SettingFieldDescription,
} from "@/components/shared/setting-field"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { connectOpenRouter } from "@/services/ai/openrouter-oauth"
import { toast } from "sonner"
import type { AiProvider } from "@/store/slices/ai-settings.slice"

export type SettingsTab = "general" | "planner" | "sync" | "ai"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTab?: SettingsTab
}

// ── General: language + theme ──────────────────────
function GeneralSettings() {
  const { language, setLanguage, t } = useLanguage()
  const { theme, setTheme } = useTheme()

  return (
    <section className="flex flex-col gap-4">
      <SettingField>
        <SettingFieldTitle>{t.settings.language}</SettingFieldTitle>
        <Select
          value={language}
          onValueChange={(v) => setLanguage(v as Language)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="zh">中文</SelectItem>
          </SelectContent>
        </Select>
      </SettingField>

      <SettingField>
        <SettingFieldTitle>{t.settings.theme}</SettingFieldTitle>
        <Select
          value={theme}
          onValueChange={(v) => setTheme(v as "system" | "light" | "dark")}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">{t.settings.themeSystem}</SelectItem>
            <SelectItem value="light">{t.settings.themeLight}</SelectItem>
            <SelectItem value="dark">{t.settings.themeDark}</SelectItem>
          </SelectContent>
        </Select>
      </SettingField>
    </section>
  )
}

// ── Planner: capacity + forced thresholds ──────────
function PlannerSettings() {
  const { t } = useLanguage()
  const policy = useAppStore((s) => s.policy)
  const updatePolicy = useAppStore((s) => s.updatePolicy)

  const [dailyCapacity, setDailyCapacity] = useState<number | undefined>(
    policy.dailyCapacityMinutes
  )
  const [taskDays, setTaskDays] = useState(String(policy.taskForcedTodoDays))
  const [goalDays, setGoalDays] = useState(String(policy.goalForcedFocusDays))
  const [maxFocus, setMaxFocus] = useState(String(policy.maxFocusGoals))

  const commitTaskDays = () => {
    const parsed = Math.max(0, Math.floor(Number(taskDays) || 0))
    setTaskDays(String(parsed))
    updatePolicy({ taskForcedTodoDays: parsed })
  }

  const commitGoalDays = () => {
    const parsed = Math.max(0, Math.floor(Number(goalDays) || 0))
    setGoalDays(String(parsed))
    updatePolicy({ goalForcedFocusDays: parsed })
  }

  const commitMaxFocus = () => {
    const parsed = Math.max(1, Math.floor(Number(maxFocus) || 1))
    setMaxFocus(String(parsed))
    updatePolicy({ maxFocusGoals: parsed })
  }

  return (
    <section className="flex flex-col gap-4">
      <SettingField>
        <SettingFieldTitle>
          {t.settings.dailyCapacity}
        </SettingFieldTitle>
        <SettingFieldDescription>
          {t.settings.dailyCapacityHelp}
        </SettingFieldDescription>
        <DurationInput
          value={dailyCapacity}
          onChange={(value) => {
            setDailyCapacity(value)
            updatePolicy({ dailyCapacityMinutes: value ?? 480 })
          }}
        />
      </SettingField>

      <SettingField>
        <SettingFieldTitle>
          {t.settings.taskForcedThreshold}
        </SettingFieldTitle>
        <SettingFieldDescription>
          {t.settings.taskForcedThresholdHelp}
        </SettingFieldDescription>
        <Input
          type="number"
          min={0}
          value={taskDays}
          onChange={(e) => setTaskDays(e.target.value)}
          onBlur={commitTaskDays}
        />
      </SettingField>

      <SettingField>
        <SettingFieldTitle>
          {t.settings.goalForcedThreshold}
        </SettingFieldTitle>
        <SettingFieldDescription>
          {t.settings.goalForcedThresholdHelp}
        </SettingFieldDescription>
        <Input
          type="number"
          min={0}
          value={goalDays}
          onChange={(e) => setGoalDays(e.target.value)}
          onBlur={commitGoalDays}
        />
      </SettingField>

      <SettingField>
        <SettingFieldTitle>
          {t.settings.maxFocusGoals}
        </SettingFieldTitle>
        <SettingFieldDescription>
          {t.settings.maxFocusGoalsHelp}
        </SettingFieldDescription>
        <Input
          type="number"
          min={1}
          value={maxFocus}
          onChange={(e) => setMaxFocus(e.target.value)}
          onBlur={commitMaxFocus}
        />
      </SettingField>
    </section>
  )
}

// ── AI: provider + conditional credentials ─────────
function AiSettings() {
  const { t } = useLanguage()
  const aiSettings = useAppStore((s) => s.aiSettings)
  const updateAiSettings = useAppStore((s) => s.updateAiSettings)

  const [provider, setProvider] = useState<AiProvider>(aiSettings.provider)
  const [apiKey, setApiKey] = useState(aiSettings.openRouterApiKey)
  const [model, setModel] = useState(aiSettings.openRouterModel)
  const [deepseekKey, setDeepseekKey] = useState(aiSettings.deepseekApiKey)
  const [deepseekModel, setDeepseekModel] = useState(aiSettings.deepseekModel)
  const [isConnecting, setIsConnecting] = useState(false)

  // connectOpenRouter redirects the whole page and never resolves — the
  // callback page finishes the flow and reopens this dialog with the key saved.
  const handleConnectOpenRouter = async () => {
    setIsConnecting(true)
    try {
      await connectOpenRouter()
    } catch {
      toast.error(t.openRouterOAuth.connectFailedToast)
      setIsConnecting(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <SettingField>
        <SettingFieldTitle>{t.settings.aiProvider}</SettingFieldTitle>
        <SettingFieldDescription>
          {t.settings.aiProviderHelp}
        </SettingFieldDescription>
        <Select
          value={provider}
          onValueChange={(v) => {
            const next = v as AiProvider
            setProvider(next)
            updateAiSettings({ provider: next })
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openrouter">OpenRouter</SelectItem>
            <SelectItem value="deepseek">DeepSeek</SelectItem>
          </SelectContent>
        </Select>
      </SettingField>

      {provider === "openrouter" && (
        <>
          <SettingField>
            <SettingFieldTitle>
              {t.settings.openRouterApiKey}
            </SettingFieldTitle>
            <SettingFieldDescription>
              {t.settings.openRouterApiKeyHelp}
            </SettingFieldDescription>
            <div className="flex gap-2">
              <Input
                type="password"
                autoComplete="off"
                className="flex-1"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onBlur={() => updateAiSettings({ openRouterApiKey: apiKey })}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={isConnecting}
                onClick={() => void handleConnectOpenRouter()}
              >
                {t.settings.openRouterConnect}
              </Button>
            </div>
          </SettingField>

          <SettingField>
            <SettingFieldTitle>
              {t.settings.openRouterModel}
            </SettingFieldTitle>
            <SettingFieldDescription>
              {t.settings.openRouterModelHelp}
            </SettingFieldDescription>
            <Input
              value={model}
              placeholder={t.settings.openRouterModelPlaceholder}
              onChange={(e) => setModel(e.target.value)}
              onBlur={() => updateAiSettings({ openRouterModel: model })}
            />
          </SettingField>
        </>
      )}

      {provider === "deepseek" && (
        <>
          <SettingField>
            <SettingFieldTitle>
              {t.settings.deepseekApiKey}
            </SettingFieldTitle>
            <SettingFieldDescription>
              {t.settings.deepseekApiKeyHelp}
            </SettingFieldDescription>
            <Input
              type="password"
              autoComplete="off"
              value={deepseekKey}
              onChange={(e) => setDeepseekKey(e.target.value)}
              onBlur={() => updateAiSettings({ deepseekApiKey: deepseekKey })}
            />
          </SettingField>

          <SettingField>
            <SettingFieldTitle>
              {t.settings.deepseekModel}
            </SettingFieldTitle>
            <SettingFieldDescription>
              {t.settings.deepseekModelHelp}
            </SettingFieldDescription>
            <Input
              value={deepseekModel}
              placeholder={t.settings.deepseekModelPlaceholder}
              onChange={(e) => setDeepseekModel(e.target.value)}
              onBlur={() => updateAiSettings({ deepseekModel })}
            />
          </SettingField>
        </>
      )}
    </section>
  )
}

export function SettingsDialog({
  open,
  onOpenChange,
  defaultTab = "general",
}: SettingsDialogProps) {
  const { t } = useLanguage()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <div className="flex flex-col gap-6">
          <DialogTitle>{t.settings.title}</DialogTitle>

          <Tabs
            defaultValue={defaultTab}
            orientation="vertical"
            className="min-h-[420px] gap-8"
          >
            <TabsList variant="line" className="shrink-0">
              <TabsTrigger value="general">{t.settings.tabGeneral}</TabsTrigger>
              <TabsTrigger value="planner">{t.settings.tabPlanner}</TabsTrigger>
              <TabsTrigger value="sync">{t.settings.tabSync}</TabsTrigger>
              <TabsTrigger value="ai">{t.settings.tabAi}</TabsTrigger>
            </TabsList>

            <div className="max-h-[70vh] flex-1 overflow-y-auto">
              <TabsContent value="general">
                <GeneralSettings />
              </TabsContent>
              <TabsContent value="planner">
                <PlannerSettings />
              </TabsContent>
              <TabsContent value="sync">
                <SyncSettings />
              </TabsContent>
              <TabsContent value="ai">
                <AiSettings />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
