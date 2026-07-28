import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { GoalFocusStatus } from "@/domain/derived/GoalFocus"
import type { FocusQuotaVM } from "@/domain/view-models/HomePageVM"

export interface GoalListCardVM {
  goal: GoalEntity
  isDone: boolean
  completedCount: number
  totalCount: number
  dueLabel?: string
  repeatLabel?: string
  isFocused: boolean
  isForced?: boolean
  focusStatuses?: GoalFocusStatus[]
}

export interface MyGoalsPageVM {
  inProgress: GoalListCardVM[]
  done: GoalListCardVM[]
  focusQuota: FocusQuotaVM
}
