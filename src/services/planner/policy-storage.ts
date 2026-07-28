import type { PlannerPolicy } from "@/services/planner/types"

const POLICY_STORAGE_KEY = "track-planner-policy"

export const DEFAULT_POLICY: PlannerPolicy = {
  dailyCapacityMinutes: 480,
  taskForcedTodoDays: 3,
  goalForcedFocusDays: 3,
  maxFocusGoals: 3,
}

export function readPolicyFromStorage(): PlannerPolicy {
  try {
    const raw = localStorage.getItem(POLICY_STORAGE_KEY)
    if (!raw) return DEFAULT_POLICY
    const parsed = JSON.parse(raw) as Partial<PlannerPolicy>
    return {
      dailyCapacityMinutes:
        typeof parsed.dailyCapacityMinutes === "number" &&
        Number.isFinite(parsed.dailyCapacityMinutes) &&
        parsed.dailyCapacityMinutes >= 1
          ? Math.floor(parsed.dailyCapacityMinutes)
          : DEFAULT_POLICY.dailyCapacityMinutes,
      taskForcedTodoDays:
        typeof parsed.taskForcedTodoDays === "number" &&
        Number.isFinite(parsed.taskForcedTodoDays) &&
        parsed.taskForcedTodoDays >= 0
          ? Math.floor(parsed.taskForcedTodoDays)
          : DEFAULT_POLICY.taskForcedTodoDays,
      goalForcedFocusDays:
        typeof parsed.goalForcedFocusDays === "number" &&
        Number.isFinite(parsed.goalForcedFocusDays) &&
        parsed.goalForcedFocusDays >= 0
          ? Math.floor(parsed.goalForcedFocusDays)
          : DEFAULT_POLICY.goalForcedFocusDays,
      maxFocusGoals:
        typeof parsed.maxFocusGoals === "number" &&
        Number.isFinite(parsed.maxFocusGoals) &&
        parsed.maxFocusGoals >= 1
          ? Math.floor(parsed.maxFocusGoals)
          : DEFAULT_POLICY.maxFocusGoals,
    }
  } catch {
    return DEFAULT_POLICY
  }
}

export function writePolicyToStorage(policy: PlannerPolicy) {
  localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(policy))
}
