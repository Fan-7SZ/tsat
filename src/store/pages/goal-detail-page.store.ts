import { create } from "zustand"

import type { SelectTriggerMode } from "@/components/trigger/TriggerPanel"
import type { TaskID } from "@/domain/value-objects/types"

export type GoalDetailTab = "details" | "tasks"

type GoalDetailPageStore = {
  isCreateTaskOpen: boolean
  isDeleteOpen: boolean
  isTriggerSettingOpen: boolean
  deleteTaskTarget: TaskID | null
  taskFilter: string
  triggerOption: SelectTriggerMode
  setCreateTaskOpen: (open: boolean) => void
  setDeleteOpen: (open: boolean) => void
  setTriggerSettingOpen: (open: boolean) => void
  setDeleteTaskTarget: (taskId: TaskID | null) => void
  setTaskFilter: (value: string) => void
  setTriggerOption: (value: SelectTriggerMode) => void
  resetUiState: () => void
}

export const useGoalDetailPageStore = create<GoalDetailPageStore>()((set) => ({
  isCreateTaskOpen: false,
  isDeleteOpen: false,
  isTriggerSettingOpen: false,
  deleteTaskTarget: null,
  taskFilter: "",
  triggerOption: null,
  setCreateTaskOpen: (isCreateTaskOpen) => set({ isCreateTaskOpen }),
  setDeleteOpen: (isDeleteOpen) => set({ isDeleteOpen }),
  setTriggerSettingOpen: (isTriggerSettingOpen) =>
    set({ isTriggerSettingOpen }),
  setDeleteTaskTarget: (deleteTaskTarget) => set({ deleteTaskTarget }),
  setTaskFilter: (taskFilter) => set({ taskFilter }),
  setTriggerOption: (triggerOption) => set({ triggerOption }),
  resetUiState: () =>
    set({
      isCreateTaskOpen: false,
      isDeleteOpen: false,
      isTriggerSettingOpen: false,
      deleteTaskTarget: null,
      taskFilter: "",
      triggerOption: null,
    }),
}))
