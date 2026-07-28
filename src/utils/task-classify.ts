import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"

export type TaskCompletionCategory = "single" | "multi" | "repeat" | "trigger"

/**
 * Classifies a task into a completion category that drives the completion
 * control UX. repeat / trigger are mutually exclusive scheduling modes; a task
 * with neither is a plain single-run task (total === 1) or a multi-run counter
 * (total > 1).
 */
export function classifyTask(task: TaskGroupEntity): TaskCompletionCategory {
  if (task.repeat != null) return "repeat"
  if (task.trigger != null) return "trigger"
  return task.total > 1 ? "multi" : "single"
}
