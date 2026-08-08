import { beforeEach, describe, expect, it } from "vitest"

import type { TaskID } from "@/domain/value-objects/types"
import { useGoalDetailPageStore } from "@/store/pages/goal-detail-page.store"

describe("useGoalDetailPageStore", () => {
  beforeEach(() => {
    useGoalDetailPageStore.getState().resetUiState()
  })

  it("starts with everything closed", () => {
    const state = useGoalDetailPageStore.getState()
    expect(state.isCreateTaskOpen).toBe(false)
    expect(state.isDeleteOpen).toBe(false)
    expect(state.isTriggerSettingOpen).toBe(false)
    expect(state.deleteTaskTarget).toBeNull()
    expect(state.taskFilter).toBe("")
    expect(state.triggerOption).toBeNull()
  })

  it("setters update their fields", () => {
    const s = useGoalDetailPageStore.getState()
    s.setCreateTaskOpen(true)
    s.setDeleteOpen(true)
    s.setTriggerSettingOpen(true)
    s.setDeleteTaskTarget("task-1" as TaskID)
    s.setTaskFilter("water")

    const state = useGoalDetailPageStore.getState()
    expect(state.isCreateTaskOpen).toBe(true)
    expect(state.isDeleteOpen).toBe(true)
    expect(state.isTriggerSettingOpen).toBe(true)
    expect(state.deleteTaskTarget).toBe("task-1")
    expect(state.taskFilter).toBe("water")
  })

  it("setTriggerOption stores the selected mode and null clears it", () => {
    useGoalDetailPageStore.getState().setTriggerOption("daily")
    expect(useGoalDetailPageStore.getState().triggerOption).toBe("daily")

    useGoalDetailPageStore.getState().setTriggerOption(null)
    expect(useGoalDetailPageStore.getState().triggerOption).toBeNull()
  })

  it("resetUiState restores every field to its default", () => {
    const s = useGoalDetailPageStore.getState()
    s.setCreateTaskOpen(true)
    s.setDeleteTaskTarget("task-1" as TaskID)
    s.setTaskFilter("x")

    useGoalDetailPageStore.getState().resetUiState()

    const state = useGoalDetailPageStore.getState()
    expect(state.isCreateTaskOpen).toBe(false)
    expect(state.deleteTaskTarget).toBeNull()
    expect(state.taskFilter).toBe("")
  })
})
