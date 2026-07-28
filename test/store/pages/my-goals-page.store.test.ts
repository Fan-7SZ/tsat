import { beforeEach, describe, expect, it } from "vitest"

import type { GoalID } from "@/domain/value-objects/types"
import { useMyGoalsPageStore } from "@/store/pages/my-goals-page.store"

const goalA = "goal-a" as GoalID
const goalB = "goal-b" as GoalID

describe("useMyGoalsPageStore", () => {
  beforeEach(() => {
    useMyGoalsPageStore.getState().resetUiState()
  })

  it("setCreateGoalOpen / setDeleteOpen toggle their flags", () => {
    useMyGoalsPageStore.getState().setCreateGoalOpen(true)
    useMyGoalsPageStore.getState().setDeleteOpen(true)

    const state = useMyGoalsPageStore.getState()
    expect(state.isCreateGoalOpen).toBe(true)
    expect(state.isDeleteOpen).toBe(true)
  })

  it("enterSelectMode flips the flag; exitSelectMode clears selection and dialogs", () => {
    useMyGoalsPageStore.getState().enterSelectMode()
    useMyGoalsPageStore.getState().toggleGoalSelection(goalA, true)
    useMyGoalsPageStore.getState().setDeleteOpen(true)

    expect(useMyGoalsPageStore.getState().isSelectMode).toBe(true)

    useMyGoalsPageStore.getState().exitSelectMode()

    const state = useMyGoalsPageStore.getState()
    expect(state.isSelectMode).toBe(false)
    expect(state.selectedGoalIds).toEqual([])
    expect(state.isDeleteOpen).toBe(false)
  })

  it("toggleGoalSelection adds then removes a goal", () => {
    useMyGoalsPageStore.getState().toggleGoalSelection(goalA, true)
    useMyGoalsPageStore.getState().toggleGoalSelection(goalB, true)
    expect(useMyGoalsPageStore.getState().selectedGoalIds).toEqual([
      goalA,
      goalB,
    ])

    useMyGoalsPageStore.getState().toggleGoalSelection(goalA, true)
    expect(useMyGoalsPageStore.getState().selectedGoalIds).toEqual([goalB])
  })

  it("toggleGoalSelection ignores non-selectable goals", () => {
    useMyGoalsPageStore.getState().toggleGoalSelection(goalA, false)
    expect(useMyGoalsPageStore.getState().selectedGoalIds).toEqual([])
  })

  it("syncSelectableGoalIds prunes selections that are no longer selectable", () => {
    useMyGoalsPageStore.getState().toggleGoalSelection(goalA, true)
    useMyGoalsPageStore.getState().toggleGoalSelection(goalB, true)

    useMyGoalsPageStore.getState().syncSelectableGoalIds([goalB])

    expect(useMyGoalsPageStore.getState().selectedGoalIds).toEqual([goalB])
  })

  it("syncSelectableGoalIds keeps the same array when nothing was pruned", () => {
    useMyGoalsPageStore.getState().toggleGoalSelection(goalA, true)
    const before = useMyGoalsPageStore.getState().selectedGoalIds

    useMyGoalsPageStore.getState().syncSelectableGoalIds([goalA, goalB])

    expect(useMyGoalsPageStore.getState().selectedGoalIds).toBe(before)
  })

  it("resetUiState restores defaults", () => {
    useMyGoalsPageStore.getState().setCreateGoalOpen(true)
    useMyGoalsPageStore.getState().enterSelectMode()
    useMyGoalsPageStore.getState().toggleGoalSelection(goalA, true)
    useMyGoalsPageStore.getState().setDeleteOpen(true)

    useMyGoalsPageStore.getState().resetUiState()

    const state = useMyGoalsPageStore.getState()
    expect(state.isCreateGoalOpen).toBe(false)
    expect(state.isSelectMode).toBe(false)
    expect(state.selectedGoalIds).toEqual([])
    expect(state.isDeleteOpen).toBe(false)
  })
})
