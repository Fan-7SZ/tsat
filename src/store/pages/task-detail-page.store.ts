import { create } from "zustand"

import type { SelectTriggerMode } from "@/components/trigger/TriggerPanel"
import type { TaskID } from "@/domain/value-objects/types"

type TaskDetailPageStore = {
  isDeleteOpen: boolean
  deleteTaskTarget: TaskID | null
  isTriggerSettingOpen: boolean
  triggerOption: SelectTriggerMode
  setDeleteOpen: (open: boolean) => void
  setDeleteTaskTarget: (taskId: TaskID | null) => void
  setTriggerSettingOpen: (open: boolean) => void
  setTriggerOption: (value: SelectTriggerMode) => void
  resetUiState: () => void
}

export const useTaskDetailPageStore = create<TaskDetailPageStore>()((set) => ({
  isDeleteOpen: false,
  deleteTaskTarget: null,
  isTriggerSettingOpen: false,
  triggerOption: null,
  setDeleteOpen: (isDeleteOpen) => set({ isDeleteOpen }),
  setDeleteTaskTarget: (deleteTaskTarget) => set({ deleteTaskTarget }),
  setTriggerSettingOpen: (isTriggerSettingOpen) =>
    set({ isTriggerSettingOpen }),
  setTriggerOption: (triggerOption) => set({ triggerOption }),
  resetUiState: () =>
    set({
      isDeleteOpen: false,
      deleteTaskTarget: null,
      isTriggerSettingOpen: false,
      triggerOption: null,
    }),
}))
