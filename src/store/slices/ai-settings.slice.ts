import type { StateCreator } from "zustand"
import type { AppStore } from "../store.types"

// ── AI Settings ───────────────────────────────────────────
const AI_SETTINGS_KEY = "track-ai-settings"

export type AiProvider = "openrouter" | "deepseek"

export interface AiSettings {
  provider: AiProvider
  openRouterApiKey: string
  openRouterModel: string
  deepseekApiKey: string
  deepseekModel: string
}

const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: "openrouter",
  openRouterApiKey: "",
  openRouterModel: "openai/gpt-4o-mini",
  deepseekApiKey: "",
  deepseekModel: "deepseek-v4-flash",
}

function readAiSettingsFromStorage(): AiSettings {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_KEY)
    if (!raw) return DEFAULT_AI_SETTINGS
    const parsed = JSON.parse(raw) as Partial<AiSettings>
    return {
      provider:
        parsed.provider === "openrouter" || parsed.provider === "deepseek"
          ? parsed.provider
          : DEFAULT_AI_SETTINGS.provider,
      openRouterApiKey:
        typeof parsed.openRouterApiKey === "string"
          ? parsed.openRouterApiKey
          : DEFAULT_AI_SETTINGS.openRouterApiKey,
      openRouterModel:
        typeof parsed.openRouterModel === "string" &&
        parsed.openRouterModel.length > 0
          ? parsed.openRouterModel
          : DEFAULT_AI_SETTINGS.openRouterModel,
      deepseekApiKey:
        typeof parsed.deepseekApiKey === "string"
          ? parsed.deepseekApiKey
          : DEFAULT_AI_SETTINGS.deepseekApiKey,
      deepseekModel:
        typeof parsed.deepseekModel === "string" &&
        parsed.deepseekModel.length > 0
          ? parsed.deepseekModel
          : DEFAULT_AI_SETTINGS.deepseekModel,
    }
  } catch {
    return DEFAULT_AI_SETTINGS
  }
}

function writeAiSettingsToStorage(settings: AiSettings) {
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings))
}

// ── Slice ─────────────────────────────────────────────────
export interface AiSettingsSlice {
  aiSettings: AiSettings
  updateAiSettings: (patch: Partial<AiSettings>) => void
}

export const createAiSettingsSlice: StateCreator<
  AppStore,
  [],
  [],
  AiSettingsSlice
> = (set, get) => ({
  aiSettings: readAiSettingsFromStorage(),
  updateAiSettings: (patch) => {
    const next = { ...get().aiSettings, ...patch }
    set({ aiSettings: next })
    writeAiSettingsToStorage(next)
  },
})
