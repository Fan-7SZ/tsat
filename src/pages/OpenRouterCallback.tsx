import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useLanguage } from "@/components/shared/language-provider"
import { exchangeOpenRouterCode } from "@/services/ai/openrouter-oauth"
import { useAppStore } from "@/store/app-store"
import { useUiStore } from "@/store/ui-store"

type ExchangeStatus = "exchanging" | "success" | "error"

/**
 * Landing page for the OpenRouter PKCE redirect: exchange the one-time code
 * with the verifier this tab stored before redirecting, save the key, and
 * return to the app with the AI settings reopened.
 */
export function OpenRouterCallback() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const copy = t.openRouterOAuth
  // Read the one-time code once at mount; arriving without one is an error.
  const [code] = useState(() =>
    new URLSearchParams(window.location.search).get("code")
  )
  const [status, setStatus] = useState<ExchangeStatus>(() =>
    code ? "exchanging" : "error"
  )

  useEffect(() => {
    // Drop the one-time code from the URL (and from history) right away.
    window.history.replaceState(null, "", "/auth/openrouter")
    if (!code) return
    let cancelled = false
    exchangeOpenRouterCode(code)
      .then((key) => {
        useAppStore.getState().updateAiSettings({
          provider: "openrouter",
          openRouterApiKey: key,
        })
        if (!cancelled) setStatus("success")
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })
    return () => {
      cancelled = true
    }
  }, [code])

  const handleComplete = () => {
    // Set the request before navigating; MainLayout consumes it on mount and
    // reopens the settings dialog on the AI tab, key already filled in.
    if (status === "success") {
      useUiStore.getState().openSettings("ai")
    }
    navigate("/", { replace: true })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-md">
        {status === "exchanging" && (
          <CardHeader>
            <CardTitle>{copy.exchangingTitle}</CardTitle>
            <CardDescription>{copy.exchangingDescription}</CardDescription>
          </CardHeader>
        )}
        {status === "success" && (
          <>
            <CardHeader>
              <CardTitle>{copy.successTitle}</CardTitle>
              <CardDescription>{copy.successDescription}</CardDescription>
            </CardHeader>
            <CardFooter className="justify-end">
              <Button type="button" onClick={handleComplete}>
                {copy.done}
              </Button>
            </CardFooter>
          </>
        )}
        {status === "error" && (
          <>
            <CardHeader>
              <CardTitle>{copy.errorTitle}</CardTitle>
              <CardDescription>{copy.errorDescription}</CardDescription>
            </CardHeader>
            <CardFooter className="justify-end">
              <Button type="button" onClick={handleComplete}>
                {copy.returnToApp}
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </main>
  )
}
