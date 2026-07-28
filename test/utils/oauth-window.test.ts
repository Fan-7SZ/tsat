import { afterEach, describe, expect, it, vi } from "vitest"
import {
  isOAuthPopupWindow,
  oauthPopupName,
  shouldUseFullPageOAuthFlow,
} from "@/utils/oauth-window"

// Node environment: no window by default, so UA / touch points / window.name are fully controllable.
function stubBrowser({
  userAgent,
  maxTouchPoints = 0,
  name = "",
}: {
  userAgent: string
  maxTouchPoints?: number
  name?: string
}): void {
  const navigator = { userAgent, maxTouchPoints }
  vi.stubGlobal("window", { navigator, name })
  vi.stubGlobal("navigator", navigator)
}

const DESKTOP_CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
const MAC_SAFARI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("shouldUseFullPageOAuthFlow", () => {
  it("returns false without a window (SSR / worker)", () => {
    expect(typeof window).toBe("undefined")
    expect(shouldUseFullPageOAuthFlow()).toBe(false)
  })

  it.each([
    [
      "Android",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
    ],
    [
      "iPhone",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    ],
    [
      "iPad",
      "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/604.1",
    ],
    [
      "iPod",
      "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
    ],
    ["generic Mobile", "SomeBrowser/1.0 Mobile"],
  ])("mobile UA (%s) uses the full-page flow", (_label, userAgent) => {
    stubBrowser({ userAgent })
    expect(shouldUseFullPageOAuthFlow()).toBe(true)
  })

  it("iPadOS desktop mode (Macintosh UA + multi-touch) uses the full-page flow", () => {
    stubBrowser({ userAgent: MAC_SAFARI_UA, maxTouchPoints: 5 })
    expect(shouldUseFullPageOAuthFlow()).toBe(true)
  })

  it("a real desktop Mac (no touch points) uses the popup", () => {
    stubBrowser({ userAgent: MAC_SAFARI_UA, maxTouchPoints: 0 })
    expect(shouldUseFullPageOAuthFlow()).toBe(false)
  })

  it("desktop Windows Chrome uses the popup", () => {
    stubBrowser({ userAgent: DESKTOP_CHROME_UA })
    expect(shouldUseFullPageOAuthFlow()).toBe(false)
  })
})

describe("oauthPopupName", () => {
  it("builds <provider>-oauth", () => {
    expect(oauthPopupName("openrouter")).toBe("openrouter-oauth")
    expect(oauthPopupName("google")).toBe("google-oauth")
  })
})

describe("isOAuthPopupWindow", () => {
  it("returns false without a window", () => {
    expect(isOAuthPopupWindow()).toBe(false)
  })

  it("treats a window.name ending in -oauth as an OAuth popup", () => {
    stubBrowser({ userAgent: DESKTOP_CHROME_UA, name: "google-oauth" })
    expect(isOAuthPopupWindow()).toBe(true)
  })

  it("a normal window (empty or unrelated name) is not an OAuth popup", () => {
    stubBrowser({ userAgent: DESKTOP_CHROME_UA, name: "" })
    expect(isOAuthPopupWindow()).toBe(false)

    stubBrowser({ userAgent: DESKTOP_CHROME_UA, name: "main-window" })
    expect(isOAuthPopupWindow()).toBe(false)
  })
})
