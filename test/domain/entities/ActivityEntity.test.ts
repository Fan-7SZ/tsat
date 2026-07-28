import { describe, expect, it } from "vitest"
import { createStableRepeatResolutionActivityId } from "@/domain/entities/ActivityEntity"
import type { TaskID } from "@/domain/value-objects/types"
import { LocalDateKeySchema } from "@/domain/value-objects/schemas"

describe("createStableRepeatResolutionActivityId", () => {
  it("uses the original planned date so compacted runtime ids cannot collide", () => {
    const taskId = "task-1" as TaskID
    const day9 = LocalDateKeySchema.parse("2026-05-09")
    const day10 = LocalDateKeySchema.parse("2026-05-10")

    expect(
      createStableRepeatResolutionActivityId("repeat-skip", taskId, day9)
    ).toBe("act::repeat-skip::repeat-resolution::task-1::2026-05-09")
    expect(
      createStableRepeatResolutionActivityId("repeat-skip", taskId, day9)
    ).not.toBe(
      createStableRepeatResolutionActivityId("repeat-skip", taskId, day10)
    )
  })
})
