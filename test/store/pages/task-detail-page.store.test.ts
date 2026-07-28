import { beforeEach, describe, expect, it } from "vitest"

import type { TaskID } from "@/domain/value-objects/types"
import { useTaskDetailPageStore } from "@/store/pages/task-detail-page.store"

describe("useTaskDetailPageStore", () => {
  beforeEach(() => {
    useTaskDetailPageStore.getState().resetUiState()
  })

  it("starts closed with no delete target and no trigger option", () => {
    const state = useTaskDetailPageStore.getState()
    expect(state.isDeleteOpen).toBe(false)
    expect(state.deleteTaskTarget).toBeNull()
    expect(state.isTriggerSettingOpen).toBe(false)
    expect(state.triggerOption).toBeNull()
  })

  it("setters update their fields", () => {
    const s = useTaskDetailPageStore.getState()
    s.setDeleteOpen(true)
    s.setDeleteTaskTarget("task-1" as TaskID)
    s.setTriggerSettingOpen(true)
    s.setTriggerOption("weekly")

    const state = useTaskDetailPageStore.getState()
    expect(state.isDeleteOpen).toBe(true)
    expect(state.deleteTaskTarget).toBe("task-1")
    expect(state.isTriggerSettingOpen).toBe(true)
    expect(state.triggerOption).toBe("weekly")
  })

  it("resetUiState restores every field to its default", () => {
    const s = useTaskDetailPageStore.getState()
    s.setDeleteOpen(true)
    s.setDeleteTaskTarget("task-1" as TaskID)
    s.setTriggerSettingOpen(true)
    s.setTriggerOption("custom")

    useTaskDetailPageStore.getState().resetUiState()

    const state = useTaskDetailPageStore.getState()
    expect(state.isDeleteOpen).toBe(false)
    expect(state.deleteTaskTarget).toBeNull()
    expect(state.isTriggerSettingOpen).toBe(false)
    expect(state.triggerOption).toBeNull()
  })
})
