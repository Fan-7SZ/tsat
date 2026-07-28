import { create } from "zustand"

import type { GoalID } from "@/domain/value-objects/types"

type MyGoalsPageStore = {
  isCreateGoalOpen: boolean
  isSelectMode: boolean
  selectedGoalIds: GoalID[]
  isDeleteOpen: boolean
  setCreateGoalOpen: (open: boolean) => void
  enterSelectMode: () => void
  exitSelectMode: () => void
  toggleGoalSelection: (goalId: GoalID, isSelectable: boolean) => void
  syncSelectableGoalIds: (goalIds: GoalID[]) => void
  setDeleteOpen: (open: boolean) => void
  resetUiState: () => void
}

export const useMyGoalsPageStore = create<MyGoalsPageStore>()((set) => ({
  isCreateGoalOpen: false,
  isSelectMode: false,
  selectedGoalIds: [],
  isDeleteOpen: false,
  setCreateGoalOpen: (open) => set({ isCreateGoalOpen: open }),
  enterSelectMode: () => set({ isSelectMode: true }),
  exitSelectMode: () =>
    set({
      isSelectMode: false,
      selectedGoalIds: [],
      isDeleteOpen: false,
    }),
  toggleGoalSelection: (goalId, isSelectable) => {
    if (!isSelectable) {
      return
    }

    set((state) => {
      const nextSelected = new Set(state.selectedGoalIds)
      if (nextSelected.has(goalId)) {
        nextSelected.delete(goalId)
      } else {
        nextSelected.add(goalId)
      }

      return {
        selectedGoalIds: [...nextSelected],
      }
    })
  },
  syncSelectableGoalIds: (goalIds) =>
    set((state) => {
      const nextGoalIds = new Set(goalIds)
      const nextSelectedGoalIds = state.selectedGoalIds.filter((goalId) =>
        nextGoalIds.has(goalId)
      )

      if (nextSelectedGoalIds.length === state.selectedGoalIds.length) {
        return {}
      }

      return {
        selectedGoalIds: nextSelectedGoalIds,
      }
    }),
  setDeleteOpen: (open) => set({ isDeleteOpen: open }),
  resetUiState: () =>
    set({
      isCreateGoalOpen: false,
      isSelectMode: false,
      selectedGoalIds: [],
      isDeleteOpen: false,
    }),
}))
