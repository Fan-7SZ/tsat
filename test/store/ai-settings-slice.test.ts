import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createAiSettingsSlice,
  type AiSettingsSlice,
} from "@/store/slices/ai-settings.slice"

const AI_SETTINGS_KEY = "track-ai-settings"

/** Minimal in-memory localStorage so reads/writes stay test-scoped. */
function stubLocalStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
  }
  vi.stubGlobal("localStorage", storage)
  return map
}

function createSlice(): { slice: AiSettingsSlice; state: () => AiSettingsSlice } {
  let state: AiSettingsSlice
  const set = (partial: Partial<AiSettingsSlice>) => {
    state = { ...state, ...partial }
  }
  state = createAiSettingsSlice(
    set as never,
    (() => state) as never,
    {} as never
  )
  return { slice: state, state: () => state }
}

describe("createAiSettingsSlice", () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it("falls back to defaults when nothing is stored", () => {
    stubLocalStorage()
    const { slice } = createSlice()

    expect(slice.aiSettings).toEqual({
      provider: "openrouter",
      openRouterApiKey: "",
      openRouterModel: "openai/gpt-4o-mini",
      deepseekApiKey: "",
      deepseekModel: "deepseek-v4-flash",
    })
  })

  it("reads a fully valid stored settings object", () => {
    stubLocalStorage({
      [AI_SETTINGS_KEY]: JSON.stringify({
        provider: "deepseek",
        openRouterApiKey: "or-key",
        openRouterModel: "meta/llama",
        deepseekApiKey: "ds-key",
        deepseekModel: "deepseek-chat",
      }),
    })

    expect(createSlice().slice.aiSettings).toEqual({
      provider: "deepseek",
      openRouterApiKey: "or-key",
      openRouterModel: "meta/llama",
      deepseekApiKey: "ds-key",
      deepseekModel: "deepseek-chat",
    })
  })

  it("repairs invalid fields one by one instead of discarding the blob", () => {
    stubLocalStorage({
      [AI_SETTINGS_KEY]: JSON.stringify({
        provider: "not-a-provider",
        openRouterApiKey: 42,
        openRouterModel: "", // empty model must fall back
        deepseekApiKey: "kept",
        deepseekModel: 7,
      }),
    })

    expect(createSlice().slice.aiSettings).toEqual({
      provider: "openrouter",
      openRouterApiKey: "",
      openRouterModel: "openai/gpt-4o-mini",
      deepseekApiKey: "kept",
      deepseekModel: "deepseek-v4-flash",
    })
  })

  it("falls back to defaults on unparsable JSON", () => {
    stubLocalStorage({ [AI_SETTINGS_KEY]: "{not json" })
    expect(createSlice().slice.aiSettings.provider).toBe("openrouter")
  })

  it("falls back to defaults when localStorage itself is unavailable", () => {
    // node has no localStorage stubbed here → readAiSettingsFromStorage throws
    // internally and is caught.
    vi.stubGlobal("localStorage", undefined)
    expect(createSlice().slice.aiSettings.provider).toBe("openrouter")
  })

  it("updateAiSettings merges the patch and persists the result", () => {
    const map = stubLocalStorage()
    const { slice, state } = createSlice()

    slice.updateAiSettings({ provider: "deepseek", deepseekApiKey: "k" })

    expect(state().aiSettings).toMatchObject({
      provider: "deepseek",
      deepseekApiKey: "k",
      // untouched fields survive the merge
      openRouterModel: "openai/gpt-4o-mini",
    })
    expect(JSON.parse(map.get(AI_SETTINGS_KEY)!)).toEqual(state().aiSettings)
  })
})
