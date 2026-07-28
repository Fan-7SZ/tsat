import { create } from "zustand"

const MAX_STACK_SIZE = 10

interface NavigationState {
  entries: string[]
  currentIndex: number
  /** When true, the next location change is a restoration (back/forward), not a new push */
  isRestoring: boolean
}

interface NavigationActions {
  pushLocation: (location: string) => void
  goBackInApp: () => string | null
  goForwardInApp: () => string | null
}

export type NavigationStore = NavigationState & NavigationActions

export const useNavigationStore = create<NavigationStore>((set, get) => ({
  entries: [],
  currentIndex: -1,
  isRestoring: false,

  pushLocation(location: string) {
    const { entries, currentIndex, isRestoring } = get()

    // Skip if restoring (back/forward triggered this)
    if (isRestoring) {
      set({ isRestoring: false })
      return
    }

    // Skip duplicate consecutive location
    if (currentIndex >= 0 && entries[currentIndex] === location) {
      return
    }

    // Truncate forward branch
    const truncated = entries.slice(0, currentIndex + 1)
    truncated.push(location)

    // Enforce max stack size
    // Delete oldest entries if exceeding max size
    if (truncated.length > MAX_STACK_SIZE) {
      const overflow = truncated.length - MAX_STACK_SIZE
      truncated.splice(0, overflow)
    }

    set({
      entries: truncated,
      currentIndex: truncated.length - 1,
    })
  },

  goBackInApp() {
    const { currentIndex, entries } = get()
    if (currentIndex <= 0) return null

    const newIndex = currentIndex - 1
    set({ currentIndex: newIndex, isRestoring: true })
    return entries[newIndex]
  },

  goForwardInApp() {
    const { currentIndex, entries } = get()
    if (currentIndex >= entries.length - 1) return null

    const newIndex = currentIndex + 1
    set({ currentIndex: newIndex, isRestoring: true })
    return entries[newIndex]
  },
}))

// Derived selectors
// For indicating whether back/forward navigation is possible, used for enabling/disabling buttons
export const selectCanGoBack = (s: NavigationStore) => s.currentIndex > 0
export const selectCanGoForward = (s: NavigationStore) =>
  s.currentIndex < s.entries.length - 1
