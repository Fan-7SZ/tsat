import { beforeEach, describe, expect, it, vi } from "vitest"

// Controllable stand-in for OpenAI's chat.completions.create.
const createMock = vi.fn()
// Records the options each OpenAI client was constructed with.
const ctorMock = vi.fn()

vi.mock("openai", () => {
  class APIError extends Error {
    status?: number
  }
  class OpenAI {
    chat = { completions: { create: createMock } }
    constructor(opts: unknown) {
      ctorMock(opts)
    }
  }
  return { default: OpenAI, APIError }
})

import { APIError } from "openai"
import { estimateCount, executeTool, extractAiError } from "@/services/ai/ai"
import type { AiSettings } from "@/store/slices/ai-settings.slice"
import type { DraftSnapshot, FocusTarget } from "@/services/ai/ai-types"

const settings: AiSettings = {
  provider: "deepseek",
  openRouterApiKey: "",
  openRouterModel: "x",
  deepseekApiKey: "key",
  deepseekModel: "deepseek-chat",
}

const snapshot: DraftSnapshot = {
  goalDraft: { title: "G", description: "", dueAt: undefined },
  taskDrafts: [],
  depTree: null,
}

const focus: FocusTarget = { kind: "all" }

const msg = (content: string) => ({ choices: [{ message: { content } }] })
const validResult = JSON.stringify({ refinements: [] })

beforeEach(() => {
  createMock.mockReset()
  ctorMock.mockReset()
})

describe("chatJSON repair loop (via executeTool)", () => {
  it("re-prompts and succeeds after an initial malformed response", async () => {
    createMock
      .mockResolvedValueOnce(msg("this is not json"))
      .mockResolvedValueOnce(msg(validResult))

    const onRepair = vi.fn()
    const result = await executeTool(
      settings,
      "refineSteps",
      "instruction",
      snapshot,
      focus,
      undefined,
      undefined,
      onRepair
    )

    expect(result).toEqual({ refinements: [] })
    expect(createMock).toHaveBeenCalledTimes(2)
    expect(onRepair).toHaveBeenCalledTimes(1)
    expect(onRepair).toHaveBeenCalledWith({ attempt: 1, max: 2 })
  })

  it("throws after exhausting the repair budget (3 total attempts)", async () => {
    createMock.mockResolvedValue(msg("still not json"))

    await expect(
      executeTool(settings, "refineSteps", "instruction", snapshot, focus)
    ).rejects.toBeTruthy()
    expect(createMock).toHaveBeenCalledTimes(3)
  })

  it("feeds zod issue paths back to the model on schema-invalid JSON", async () => {
    createMock
      .mockResolvedValueOnce(
        msg(JSON.stringify({ refinements: [{ target: 1, steps: [] }] }))
      )
      .mockResolvedValueOnce(msg(validResult))

    await executeTool(settings, "refineSteps", "instruction", snapshot, focus)

    const secondCallMessages = createMock.mock.calls[1][0].messages
    const repairMessage = secondCallMessages[secondCallMessages.length - 1]
    expect(repairMessage.role).toBe("user")
    expect(repairMessage.content).toContain("previous response was invalid")
    expect(repairMessage.content).toContain("refinements.0.target")
  })

  it("treats empty content as an error and repairs", async () => {
    createMock
      .mockResolvedValueOnce(msg(""))
      .mockResolvedValueOnce(msg(validResult))

    const result = await executeTool(
      settings,
      "refineSteps",
      "instruction",
      snapshot,
      focus
    )
    expect(result).toEqual({ refinements: [] })

    const secondCallMessages = createMock.mock.calls[1][0].messages
    const repairMessage = secondCallMessages[secondCallMessages.length - 1]
    expect(repairMessage.content).toContain("Empty AI response")
  })

  it("passes a per-request timeout to the SDK", async () => {
    createMock.mockResolvedValueOnce(msg(validResult))
    await executeTool(settings, "refineSteps", "instruction", snapshot, focus)
    const secondArg = createMock.mock.calls[0][1]
    expect(secondArg).toMatchObject({ timeout: expect.any(Number) })
  })

  it("rejects immediately on an already-aborted signal without calling the API", async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      executeTool(
        settings,
        "refineSteps",
        "instruction",
        snapshot,
        focus,
        controller.signal
      )
    ).rejects.toBeTruthy()
    expect(createMock).not.toHaveBeenCalled()
  })

  it("prepends a locale directive to the system prompt", async () => {
    createMock.mockResolvedValueOnce(msg(validResult))
    await executeTool(
      settings,
      "refineSteps",
      "instruction",
      snapshot,
      focus,
      undefined,
      "zh"
    )
    const messages = createMock.mock.calls[0][0].messages
    expect(messages[0].role).toBe("system")
    expect(messages[0].content).toContain("Chinese (简体中文)")
  })

  it("falls back to the raw locale string for unknown locales", async () => {
    createMock.mockResolvedValueOnce(msg(validResult))
    await executeTool(
      settings,
      "refineSteps",
      "instruction",
      snapshot,
      focus,
      undefined,
      "fr"
    )
    expect(createMock.mock.calls[0][0].messages[0].content).toContain(
      "respond in fr"
    )
  })
})

describe("provider selection (client factory + model)", () => {
  it("uses the deepseek base URL, key and model for provider=deepseek", async () => {
    createMock.mockResolvedValueOnce(msg(validResult))
    await executeTool(settings, "refineSteps", "instruction", snapshot, focus)
    expect(ctorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://api.deepseek.com",
        apiKey: "key",
      })
    )
    expect(createMock.mock.calls[0][0].model).toBe("deepseek-chat")
  })

  it("uses the openrouter base URL, key and model otherwise", async () => {
    const openRouterSettings: AiSettings = {
      provider: "openrouter",
      openRouterApiKey: "or-key",
      openRouterModel: "openai/gpt-4o-mini",
      deepseekApiKey: "",
      deepseekModel: "",
    }
    createMock.mockResolvedValueOnce(msg(validResult))
    await executeTool(
      openRouterSettings,
      "refineSteps",
      "instruction",
      snapshot,
      focus
    )
    expect(ctorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: "or-key",
      })
    )
    expect(createMock.mock.calls[0][0].model).toBe("openai/gpt-4o-mini")
  })
})

describe("estimateCount", () => {
  const count = (value: unknown) => msg(JSON.stringify({ count: value }))

  it("returns the rounded count", async () => {
    createMock.mockResolvedValueOnce(count(5.6))
    await expect(estimateCount(settings, "sys", "user")).resolves.toBe(6)
  })

  it("coerces numeric strings", async () => {
    createMock.mockResolvedValueOnce(count("7"))
    await expect(estimateCount(settings, "sys", "user")).resolves.toBe(7)
  })

  it("clamps to the [1, 50] range", async () => {
    createMock.mockResolvedValueOnce(count(0))
    await expect(estimateCount(settings, "sys", "user")).resolves.toBe(1)
    createMock.mockResolvedValueOnce(count(999))
    await expect(estimateCount(settings, "sys", "user")).resolves.toBe(50)
  })

  it("sends the provided system and user prompts", async () => {
    createMock.mockResolvedValueOnce(count(3))
    await estimateCount(settings, "the system prompt", "the user prompt")
    const messages = createMock.mock.calls[0][0].messages
    expect(messages).toEqual([
      { role: "system", content: "the system prompt" },
      { role: "user", content: "the user prompt" },
    ])
  })
})

describe("extractAiError", () => {
  // The mocked APIError takes a plain message; the real class declares a
  // 4-argument constructor, so re-type it for the mock's runtime shape.
  const MockAPIError = APIError as unknown as new (
    message: string
  ) => InstanceType<typeof APIError> & { status?: number }

  it("maps a connection timeout by error name", () => {
    const err = new Error("timed out")
    err.name = "APIConnectionTimeoutError"
    expect(extractAiError(err)).toEqual({
      code: "timeout",
      rawMessage: "timed out",
    })
  })

  it.each([
    [401, "unauthorized"],
    [402, "paymentRequired"],
    [403, "forbidden"],
    [404, "notFound"],
    [429, "rateLimit"],
    [500, "serverError"],
    [502, "badGateway"],
    [503, "serviceUnavailable"],
  ] as const)("maps APIError status %i → %s", (status, code) => {
    const err = new MockAPIError("api failed")
    err.status = status
    expect(extractAiError(err)).toEqual({
      code,
      status,
      rawMessage: "api failed",
    })
  })

  it("maps an unlisted APIError status to apiOther", () => {
    const err = new MockAPIError("teapot")
    err.status = 418
    expect(extractAiError(err)).toMatchObject({ code: "apiOther", status: 418 })
  })

  it("maps an APIError without status to apiOther with undefined status", () => {
    const err = new MockAPIError("no status")
    expect(extractAiError(err)).toEqual({
      code: "apiOther",
      status: undefined,
      rawMessage: "no status",
    })
  })

  it("maps SyntaxError to invalidJson", () => {
    expect(extractAiError(new SyntaxError("bad token"))).toEqual({
      code: "invalidJson",
      rawMessage: "bad token",
    })
  })

  it("maps the empty-response sentinel to emptyResponse", () => {
    expect(extractAiError(new Error("Empty AI response"))).toEqual({
      code: "emptyResponse",
      rawMessage: "Empty AI response",
    })
  })

  it("maps ZodError (by name) to invalidFormat", () => {
    const err = new Error("schema mismatch")
    err.name = "ZodError"
    expect(extractAiError(err)).toEqual({
      code: "invalidFormat",
      rawMessage: "schema mismatch",
    })
  })

  it("maps other errors and non-errors to unknown", () => {
    expect(extractAiError(new Error("boom"))).toEqual({
      code: "unknown",
      rawMessage: "boom",
    })
    expect(extractAiError("plain string")).toEqual({
      code: "unknown",
      rawMessage: "plain string",
    })
  })
})
