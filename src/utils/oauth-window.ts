/**
 * Whether an OAuth flow should redirect the whole page instead of opening a
 * popup. Used by cloud sync, which needs a popup on desktop but a full-page
 * redirect where popups are unreliable.
 *
 * Mobile and touch devices (incl. iPadOS Safari reporting a "Macintosh" UA in
 * desktop mode) take the redirect: popups break the SameSite=Lax cookie
 * round-trip and the postMessage handshake in those environments.
 */
export function shouldUseFullPageOAuthFlow(): boolean {
  if (typeof window === "undefined") {
    return false
  }
  const userAgent = window.navigator.userAgent
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1)
  )
}

const OAUTH_POPUP_NAME_SUFFIX = "-oauth"

/** Window name for an OAuth popup, e.g. "openrouter-oauth", "google-oauth". */
export function oauthPopupName(provider: string): string {
  return `${provider}${OAUTH_POPUP_NAME_SUFFIX}`
}

/**
 * Whether the current window is one of the app's OAuth popups. Keyed off
 * `window.name` (set by the app's `window.open` calls, preserved across the
 * provider round-trip) rather than `window.opener`: a full-page redirect keeps
 * whatever opener the tab happened to have — e.g. a tab launched from the PWA
 * or another app — so an opener check misclassifies redirect landings as
 * popups and strands them on the relay path.
 */
export function isOAuthPopupWindow(): boolean {
  return (
    typeof window !== "undefined" &&
    window.name.endsWith(OAUTH_POPUP_NAME_SUFFIX)
  )
}
