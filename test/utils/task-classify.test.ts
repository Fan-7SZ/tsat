import { describe, expect, it } from "vitest"

import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { TaskID } from "@/domain/value-objects/types"
import { classifyTask } from "@/utils/task-classify"

function createTask(patch: Partial<TaskGroupEntity> = {}): TaskGroupEntity {
  return {
    id: "task-1" as TaskID,
    title: "Task",
    createdAt: new Date("2026-05-01T09:00:00"),
    total: 1,
    completedCount: 0,
    ...patch,
  }
}

describe("classifyTask", () => {
  it("classifies a repeat task", () => {
    const task = createTask({
      repeat: { rule: { mode: "daily", interval: 1 } },
    })
    expect(classifyTask(task)).toBe("repeat")
  })

  it("classifies a trigger task", () => {
    const task = createTask({
      trigger: { rule: { mode: "daily", interval: 1 } },
    })
    expect(classifyTask(task)).toBe("trigger")
  })

  it("repeat wins over trigger when both are present", () => {
    const task = createTask({
      repeat: { rule: { mode: "daily", interval: 1 } },
      trigger: { rule: { mode: "daily", interval: 1 } },
    })
    expect(classifyTask(task)).toBe("repeat")
  })

  it("classifies a plain single-run task", () => {
    expect(classifyTask(createTask({ total: 1 }))).toBe("single")
  })

  it("classifies a multi-run counter task", () => {
    expect(classifyTask(createTask({ total: 3 }))).toBe("multi")
  })
})
