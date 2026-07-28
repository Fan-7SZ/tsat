import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useLanguage } from "@/components/shared/language-provider"
import { saveSyncRefreshToken } from "@/services/sync/sync-auth-storage"
import { useSyncStore } from "@/store/sync-store"
import { isOAuthPopupWindow } from "@/utils/oauth-window"

type OAuthCallbackCopy = ReturnType<
  typeof useLanguage
>["t"]["sync"]["oauthCallback"]

const oauthResultSchema = z.union([
  z.object({
    type: z.literal("oauth:connected"),
    provider: z.string().min(1),
    refresh_token: z.string().min(1),
  }),
  z.object({
    type: z.literal("oauth:error"),
    provider: z.string().min(1),
    error: z.string().optional(),
    recoverable: z.boolean().optional(),
  }),
])

type OAuthResult = z.infer<typeof oauthResultSchema>

type ParsedOAuthResult =
  | { status: "ready"; result: OAuthResult }
  | { status: "invalid" }

export function OAuthCallback() {
  const [parsedResult] = useState<ParsedOAuthResult>(readOAuthResultFromHash)
  // Popup-ness comes from window.name, not window.opener: a full-page redirect
  // keeps whatever opener the tab had (PWA / external launch), and treating it
  // as a popup would skip the store refresh and post the result into the void.
  const [isPopup] = useState(isOAuthPopupWindow)
  const navigate = useNavigate()
  const { t } = useLanguage()
  const refreshSelectedProvider = useSyncStore((s) => s.refreshSelectedProvider)
  const copy = t.sync.oauthCallback

  useEffect(() => {
    window.history.replaceState(null, "", "/auth/callback")
    if (parsedResult.status !== "ready") {
      return
    }
    if (isPopup) {
      // Popup flow: the opener is the sole writer of the token. Persisting here
      // too would race the opener's first refresh — OneDrive rotates the token,
      // so the mount-time copy goes stale the moment the opener syncs, and the
      // opener re-saving it on resolve would clobber the rotated one. Post
      // immediately (not on the done click) so the opener resolves before it
      // could have started syncing with a token this page wrote.
      postResultToOpener(parsedResult.result)
      return
    }
    persistOAuthResult(parsedResult.result)
    if (parsedResult.result.type === "oauth:connected") {
      refreshSelectedProvider()
    }
  }, [parsedResult, isPopup, refreshSelectedProvider])

  const handleComplete = () => {
    if (isPopup) {
      window.close()
      return
    }
    navigate("/", { replace: true })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-md">
        {parsedResult.status === "ready" ? (
          <OAuthResultContent
            copy={copy}
            result={parsedResult.result}
            onComplete={handleComplete}
          />
        ) : (
          <>
            <CardHeader>
              <CardTitle>{copy.invalidTitle}</CardTitle>
              <CardDescription>{copy.invalidDescription}</CardDescription>
            </CardHeader>
            <CardFooter className="justify-end">
              <Button
                type="button"
                onClick={() => navigate("/", { replace: true })}
              >
                {copy.returnToApp}
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </main>
  )
}

function OAuthResultContent({
  copy,
  result,
  onComplete,
}: {
  copy: OAuthCallbackCopy
  result: OAuthResult
  onComplete: () => void
}) {
  switch (result.type) {
    case "oauth:connected":
      return (
        <>
          <CardHeader>
            <CardTitle>{copy.connectedTitle}</CardTitle>
            <CardDescription>{copy.connectedDescription}</CardDescription>
          </CardHeader>
          <CardFooter className="justify-end">
            <Button type="button" onClick={onComplete}>
              {copy.done}
            </Button>
          </CardFooter>
        </>
      )
    case "oauth:error":
      return (
        <>
          <CardHeader>
            <CardTitle>{copy.errorTitle}</CardTitle>
            <CardDescription>
              {getOAuthErrorMessage(result.error, copy)}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-end">
            <Button type="button" onClick={onComplete}>
              {copy.returnToApp}
            </Button>
          </CardFooter>
        </>
      )
  }
}

function readOAuthResultFromHash(): ParsedOAuthResult {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const encodedResult = params.get("oauth_result")
  if (!encodedResult) {
    return { status: "invalid" }
  }

  const decodedResult = decodeBase64UrlJson(encodedResult)
  const result = oauthResultSchema.safeParse(decodedResult)
  return result.success
    ? { status: "ready", result: result.data }
    : { status: "invalid" }
}

function decodeBase64UrlJson(value: string): unknown {
  try {
    const base64 = value
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "=")
    const binary = window.atob(base64)
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0)
    )
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

function persistOAuthResult(result: OAuthResult): void {
  switch (result.type) {
    case "oauth:connected":
      saveSyncRefreshToken(result.provider, result.refresh_token)
      return
    case "oauth:error":
      return
  }
}

function postResultToOpener(result: OAuthResult): void {
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage(result, window.location.origin)
  }
}

function getOAuthErrorMessage(
  error: string | undefined,
  copy: OAuthCallbackCopy
): string {
  switch (error) {
    case "invalid_oauth_state":
      return copy.errors.invalidOAuthState
    case "missing_refresh_token":
      return copy.errors.missingRefreshToken
    case "provider_error":
      return copy.errors.providerError
    case "oauth_callback_failed":
    default:
      return copy.errors.oauthCallbackFailed
  }
}
