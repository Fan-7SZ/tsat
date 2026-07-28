import { create } from "zustand"

import type { SettingsTab } from "@/components/dialogs/SettingsDialog"

/**
 * Cross-cutting UI intents that a deeply-nested component needs to hand off to a
 * layout-level owner. Currently: opening the SettingsDialog (owned by
 * MainLayout) from anywhere — e.g. an AI error's "open AI settings" link.
 * Kept separate from the persisted app store; nothing here is saved.
 */
interface UiStore {
  /** Non-null when a component has requested the settings dialog be opened. */
  settingsRequest: { tab: SettingsTab } | null
  openSettings: (tab?: SettingsTab) => void
  clearSettingsRequest: () => void
}

export const useUiStore = create<UiStore>((set) => ({
  settingsRequest: null,
  openSettings: (tab = "general") => set({ settingsRequest: { tab } }),
  clearSettingsRequest: () => set({ settingsRequest: null }),
}))
