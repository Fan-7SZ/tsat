// OpenRouter PKCE OAuth (no client secret — the whole flow runs in the browser).
// The app sends the user to openrouter.ai/auth with a code challenge; OpenRouter
// returns to /auth/openrouter with a one-time code; exchanging code + verifier
// yields a fresh API key. Docs: https://openrouter.ai/docs/use-cases/oauth-pkce
//
// The flow is a full-page redirect on every platform: the verifier stays in this
// tab's sessionStorage across the round-trip, and the callback page finishes the
// exchange and saves the key.

const VERIFIER_STORAGE_KEY = "track-openrouter-code-verifier"
const CALLBACK_PATH = "/auth/openrouter"

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return window
    .btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "")
}

async function buildAuthUrl(): Promise<string> {
  const verifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  )
  // Kept for the exchange: the callback page reads it back from this tab's
  // storage after the redirect returns.
  window.sessionStorage.setItem(VERIFIER_STORAGE_KEY, verifier)

  const url = new URL("https://openrouter.ai/auth")
  url.searchParams.set("callback_url", window.location.origin + CALLBACK_PATH)
  url.searchParams.set("code_challenge", base64UrlEncode(new Uint8Array(digest)))
  url.searchParams.set("code_challenge_method", "S256")
  return url.toString()
}

/** Thrown reasons the caller can distinguish. */
export type OpenRouterConnectError = "exchange_failed" | "missing_verifier"

/**
 * Start the OAuth flow: redirect the whole page to OpenRouter. The returned
 * promise never settles — the callback page finishes the flow after the
 * redirect brings the user back.
 */
export async function connectOpenRouter(): Promise<never> {
  window.location.assign(await buildAuthUrl())
  return new Promise<never>(() => {})
}

/**
 * Whether THIS tab holds the PKCE verifier — i.e. it initiated the flow and the
 * redirect brought it back here with a usable code.
 */
export function hasStoredOpenRouterVerifier(): boolean {
  return window.sessionStorage.getItem(VERIFIER_STORAGE_KEY) !== null
}

// The code is single-use, so concurrent calls for the same code (React 18
// strict-mode double effects) must share one request instead of burning it twice.
const exchangesInFlight = new Map<string, Promise<string>>()

/** Exchange the callback's one-time code for an API key. */
export function exchangeOpenRouterCode(code: string): Promise<string> {
  const existing = exchangesInFlight.get(code)
  if (existing) return existing
  const exchange = doExchange(code)
  exchangesInFlight.set(code, exchange)
  // A failed exchange is dropped so the same code can be retried; successes
  // stay cached — the code is single-use and must not burn a second request.
  exchange.catch(() => exchangesInFlight.delete(code))
  return exchange
}

async function doExchange(code: string): Promise<string> {
  const verifier = window.sessionStorage.getItem(VERIFIER_STORAGE_KEY)
  if (!verifier) {
    throw new Error("missing_verifier" satisfies OpenRouterConnectError)
  }
  // A network error leaves the verifier in place — the code was never
  // presented, so a retry can still succeed.
  const response = await fetch("https://openrouter.ai/api/v1/auth/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      code_verifier: verifier,
      code_challenge_method: "S256",
    }),
  })
  if (!response.ok) {
    // 4xx: the code/verifier pair was judged invalid — keeping the verifier
    // buys nothing. 5xx: transient server trouble, keep it for a retry.
    if (response.status < 500) {
      window.sessionStorage.removeItem(VERIFIER_STORAGE_KEY)
    }
    throw new Error("exchange_failed" satisfies OpenRouterConnectError)
  }
  window.sessionStorage.removeItem(VERIFIER_STORAGE_KEY)
  const data = (await response.json()) as { key?: unknown }
  if (typeof data.key !== "string" || data.key.length === 0) {
    throw new Error("exchange_failed" satisfies OpenRouterConnectError)
  }
  return data.key
}
