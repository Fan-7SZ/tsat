import { Clipboard, ClipboardCheck, ClipboardClock } from "lucide-react"
import { describe, expect, it } from "vitest"

import {
  RUNTIME_STATUS_ICON,
  RUNTIME_STATUS_ICON_COLOR,
} from "@/utils/task-runtime-icon"

describe("RUNTIME_STATUS_ICON", () => {
  it("maps each runtime status to its clipboard icon", () => {
    expect(RUNTIME_STATUS_ICON.todo).toBe(Clipboard)
    expect(RUNTIME_STATUS_ICON.inProgress).toBe(ClipboardClock)
    expect(RUNTIME_STATUS_ICON.done).toBe(ClipboardCheck)
  })
})

describe("RUNTIME_STATUS_ICON_COLOR", () => {
  it("maps each runtime status to its tint class", () => {
    expect(RUNTIME_STATUS_ICON_COLOR.todo).toBe("text-primary")
    expect(RUNTIME_STATUS_ICON_COLOR.inProgress).toBe("text-amber-500")
    expect(RUNTIME_STATUS_ICON_COLOR.done).toBe("text-emerald-600")
  })
})
