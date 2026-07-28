import { beforeEach, describe, expect, it } from "vitest"

import { useUiStore } from "@/store/ui-store"

describe("useUiStore", () => {
  beforeEach(() => {
    useUiStore.setState({ settingsRequest: null })
  })

  it("starts with no settings request", () => {
    expect(useUiStore.getState().settingsRequest).toBeNull()
  })

  it("openSettings defaults to the general tab", () => {
    useUiStore.getState().openSettings()
    expect(useUiStore.getState().settingsRequest).toEqual({ tab: "general" })
  })

  it("openSettings records the requested tab", () => {
    useUiStore.getState().openSettings("ai")
    expect(useUiStore.getState().settingsRequest).toEqual({ tab: "ai" })
  })

  it("clearSettingsRequest resets the request", () => {
    useUiStore.getState().openSettings("ai")
    useUiStore.getState().clearSettingsRequest()
    expect(useUiStore.getState().settingsRequest).toBeNull()
  })
})
