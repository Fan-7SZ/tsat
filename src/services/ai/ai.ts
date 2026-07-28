import { z } from "zod"
import OpenAI, { APIError } from "openai"
import type { AiSettings } from "@/store/slices/ai-settings.slice"
import type {
  AiToolName,
  DraftSnapshot,
  FocusTarget,
  ToolResult,
} from "./ai-types"
import { getToolDefinition } from "./ai-tools"

// ── Error extraction ──────────────────────────────────────

export type AiErrorCode =
  | "unauthorized"
  | "paymentRequired"
  | "forbidden"
  | "notFound"
  | "rateLimit"
  | "serverError"
  | "badGateway"
  | "serviceUnavailable"
  | "apiOther"
  | "invalidJson"
  | "emptyResponse"
  | "invalidFormat"
  | "timeout"
  | "unknown"

export interface AiErrorInfo {
  code: AiErrorCode
  /** HTTP status when the error came from the AI provider */
  status?: number
  /** Raw underlying message, useful for diagnostics or fallback display */
  rawMessage?: string
}

const API_STATUS_TO_CODE: Record<number, AiErrorCode> = {
  401: "unauthorized",
  402: "paymentRequired",
  403: "forbidden",
  404: "notFound",
  429: "rateLimit",
  500: "serverError",
  502: "badGateway",
  503: "serviceUnavailable",
}

export function extractAiError(err: unknown): AiErrorInfo {
  // Per-request timeout surfaces as APIConnectionTimeoutError (an APIError
  // subclass with no status), so check the name before the generic branch.
  if (err instanceof Error && err.name === "APIConnectionTimeoutError") {
    return { code: "timeout", rawMessage: err.message }
  }
  if (err instanceof APIError) {
    const status = err.status
    const code: AiErrorCode =
      (typeof status === "number" && API_STATUS_TO_CODE[status]) || "apiOther"
    return {
      code,
      status: typeof status === "number" ? status : undefined,
      rawMessage: err.message || String(err),
    }
  }
  if (err instanceof SyntaxError) {
    return { code: "invalidJson", rawMessage: err.message }
  }
  if (err instanceof Error) {
    if (err.message === "Empty AI response") {
      return { code: "emptyResponse", rawMessage: err.message }
    }
    if (err.name === "ZodError") {
      return { code: "invalidFormat", rawMessage: err.message }
    }
    return { code: "unknown", rawMessage: err.message }
  }
  return { code: "unknown", rawMessage: String(err) }
}

// ── Client factory ────────────────────────────────────────

function createClient(settings: AiSettings): OpenAI {
  const isDeepseek = settings.provider === "deepseek"
  return new OpenAI({
    baseURL: isDeepseek
      ? "https://api.deepseek.com"
      : "https://openrouter.ai/api/v1",
    apiKey: isDeepseek ? settings.deepseekApiKey : settings.openRouterApiKey,
    dangerouslyAllowBrowser: true,
  })
}

function getModel(settings: AiSettings): string {
  return settings.provider === "deepseek"
    ? settings.deepseekModel
    : settings.openRouterModel
}

// ── Locale helpers ────────────────────────────────────────

const LOCALE_NAMES: Record<string, string> = {
  zh: "Chinese (简体中文)",
  en: "English",
}

function withLocalePrompt(systemPrompt: string, locale?: string): string {
  if (!locale) return systemPrompt
  const name = LOCALE_NAMES[locale] ?? locale
  return `IMPORTANT: You MUST respond in ${name}. All generated text content (descriptions, summaries, step names, titles, etc.) MUST be written in ${name}.\n\n${systemPrompt}`
}

// ── Low-level chat call with validate→repair loop ─────────

/** Number of extra repair attempts after the initial generation. */
const MAX_REPAIR_ATTEMPTS = 2
/** Per-request timeout; a hung upstream surfaces as `timeout`. */
const AI_REQUEST_TIMEOUT_MS = 60_000

export interface RepairProgress {
  /** 1-based repair attempt number (1 = first repair after the initial call). */
  attempt: number
  /** Total repair attempts that may be made. */
  max: number
}

/** Compact, model-facing description of why the previous response was invalid. */
function describeParseError(err: unknown): string {
  if (
    err instanceof Error &&
    err.name === "ZodError" &&
    "issues" in err &&
    Array.isArray((err as { issues: unknown }).issues)
  ) {
    const issues = (
      err as { issues: Array<{ path: unknown[]; message: string }> }
    ).issues
    return issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ")
  }
  if (err instanceof SyntaxError) return `Invalid JSON: ${err.message}`
  if (err instanceof Error) return err.message
  return String(err)
}

/**
 * Call the model expecting JSON matching `schema`. On empty/malformed/
 * schema-invalid output, feed the exact error back and regenerate, up to
 * MAX_REPAIR_ATTEMPTS times (validation-in-the-loop). Only after the budget is
 * exhausted does the last error propagate to `extractAiError`.
 */
async function chatJSON<T>(
  client: OpenAI,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  schema: import("zod").ZodType<T>,
  signal?: AbortSignal,
  locale?: string,
  onRepair?: (progress: RepairProgress) => void
): Promise<T> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: withLocalePrompt(systemPrompt, locale) },
    { role: "user", content: userPrompt },
  ]

  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
    signal?.throwIfAborted()
    if (attempt > 0) onRepair?.({ attempt, max: MAX_REPAIR_ATTEMPTS })

    const response = await client.chat.completions.create(
      {
        model,
        response_format: { type: "json_object" },
        messages,
        temperature: 0.4,
      },
      { signal, timeout: AI_REQUEST_TIMEOUT_MS }
    )

    const content = response.choices[0]?.message?.content
    try {
      if (!content) throw new Error("Empty AI response")
      const parsed = JSON.parse(content) as unknown
      return schema.parse(parsed)
    } catch (err) {
      lastError = err
      if (attempt >= MAX_REPAIR_ATTEMPTS) break
      // Show the model its own output plus the exact failure, then ask again.
      messages.push({ role: "assistant", content: content ?? "" })
      messages.push({
        role: "user",
        content: `Your previous response was invalid: ${describeParseError(
          err
        )}. Return ONLY corrected JSON matching the required shape. Do not include any explanation or markdown.`,
      })
    }
  }
  throw lastError
}

// ── Count estimate (phase 1 of the two-step scenarios) ────

const countSchema = z.object({ count: z.coerce.number() })

/**
 * Ask the model for a single integer count (e.g. "how many tasks/steps").
 * Used as the cheap first phase before generating the actual content, so the UI
 * can show the right number of skeleton placeholders. Clamped to [1, 50].
 */
export async function estimateCount(
  settings: AiSettings,
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal,
  locale?: string
): Promise<number> {
  const client = await createClient(settings)
  const { count } = await chatJSON(
    client,
    getModel(settings),
    systemPrompt,
    userPrompt,
    countSchema,
    signal,
    locale
  )
  return Math.max(1, Math.min(50, Math.round(count)))
}

// ── Execute a single tool ─────────────────────────────────

export async function executeTool(
  settings: AiSettings,
  toolName: AiToolName,
  instruction: string,
  snapshot: DraftSnapshot,
  focus: FocusTarget,
  signal?: AbortSignal,
  locale?: string,
  onRepair?: (progress: RepairProgress) => void
): Promise<ToolResult> {
  const client = await createClient(settings)
  const tool = getToolDefinition(toolName)
  return chatJSON(
    client,
    getModel(settings),
    tool.buildSystemPrompt(snapshot, focus),
    tool.buildUserPrompt(instruction, snapshot, focus),
    tool.schema as import("zod").ZodType<ToolResult>,
    signal,
    locale,
    onRepair
  )
}
