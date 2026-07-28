/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { en } from "@/i18n/en"
import { zh } from "@/i18n/zh"
import type { Dictionary } from "@/i18n/types"

export type Language = "en" | "zh"

const LANGUAGE_VALUES: Language[] = ["en", "zh"]
const STORAGE_KEY = "app-language"

type LanguageProviderState = {
  language: Language
  setLanguage: (language: Language) => void
  t: Dictionary
}

const LanguageProviderContext = React.createContext<
  LanguageProviderState | undefined
>(undefined)

function isLanguage(value: string | null): value is Language {
  return value !== null && LANGUAGE_VALUES.includes(value as Language)
}

const dictionaries: Record<Language, Dictionary> = { en, zh }

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLanguage(stored)) return stored
    // First visit: detect system language
    const sysLang = navigator.language || ""
    return sysLang.startsWith("zh") ? "zh" : "en"
  })

  const setLanguage = React.useCallback((next: Language) => {
    localStorage.setItem(STORAGE_KEY, next)
    setLanguageState(next)
  }, [])

  // Cross-tab sync
  // Although it's a spa, users might open multiple tabs
  React.useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage || e.key !== STORAGE_KEY) return
      if (isLanguage(e.newValue)) {
        setLanguageState(e.newValue)
      }
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const t = dictionaries[language]

  const value = React.useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t]
  )

  return (
    <LanguageProviderContext.Provider value={value}>
      {children}
    </LanguageProviderContext.Provider>
  )
}

export function useLanguage() {
  const context = React.useContext(LanguageProviderContext)
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider.")
  }
  return context
}
