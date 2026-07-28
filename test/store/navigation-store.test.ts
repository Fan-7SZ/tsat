import { beforeEach, describe, expect, it } from "vitest"

import {
  selectCanGoBack,
  selectCanGoForward,
  useNavigationStore,
} from "@/store/navigation-store"

function resetStore() {
  useNavigationStore.setState({
    entries: [],
    currentIndex: -1,
    isRestoring: false,
  })
}

describe("useNavigationStore", () => {
  beforeEach(resetStore)

  it("pushes locations and advances the index", () => {
    const { pushLocation } = useNavigationStore.getState()
    pushLocation("/a")
    pushLocation("/b")

    const state = useNavigationStore.getState()
    expect(state.entries).toEqual(["/a", "/b"])
    expect(state.currentIndex).toBe(1)
  })

  it("skips duplicate consecutive locations", () => {
    const { pushLocation } = useNavigationStore.getState()
    pushLocation("/a")
    pushLocation("/a")

    const state = useNavigationStore.getState()
    expect(state.entries).toEqual(["/a"])
    expect(state.currentIndex).toBe(0)
  })

  it("skips the push that a restoration triggered and clears the flag", () => {
    useNavigationStore.setState({
      entries: ["/a", "/b"],
      currentIndex: 0,
      isRestoring: true,
    })

    useNavigationStore.getState().pushLocation("/a")

    const state = useNavigationStore.getState()
    expect(state.isRestoring).toBe(false)
    expect(state.entries).toEqual(["/a", "/b"])
    expect(state.currentIndex).toBe(0)
  })

  it("truncates the forward branch when pushing after going back", () => {
    const { pushLocation, goBackInApp } = useNavigationStore.getState()
    pushLocation("/a")
    pushLocation("/b")
    pushLocation("/c")
    goBackInApp() // at /b
    // A restored location change arrives first and is swallowed…
    useNavigationStore.getState().pushLocation("/b")
    // …then a genuinely new location drops the /c branch.
    useNavigationStore.getState().pushLocation("/d")

    const state = useNavigationStore.getState()
    expect(state.entries).toEqual(["/a", "/b", "/d"])
    expect(state.currentIndex).toBe(2)
  })

  it("caps the stack at 10 entries, dropping the oldest", () => {
    const { pushLocation } = useNavigationStore.getState()
    for (let i = 0; i < 12; i++) pushLocation(`/page-${i}`)

    const state = useNavigationStore.getState()
    expect(state.entries).toHaveLength(10)
    expect(state.entries[0]).toBe("/page-2")
    expect(state.entries[9]).toBe("/page-11")
    expect(state.currentIndex).toBe(9)
  })

  it("goBackInApp returns the previous entry and marks restoring", () => {
    const { pushLocation } = useNavigationStore.getState()
    pushLocation("/a")
    pushLocation("/b")

    const target = useNavigationStore.getState().goBackInApp()

    expect(target).toBe("/a")
    const state = useNavigationStore.getState()
    expect(state.currentIndex).toBe(0)
    expect(state.isRestoring).toBe(true)
  })

  it("goBackInApp returns null at the bottom of the stack", () => {
    useNavigationStore.getState().pushLocation("/a")
    expect(useNavigationStore.getState().goBackInApp()).toBeNull()
    // Empty stack too.
    resetStore()
    expect(useNavigationStore.getState().goBackInApp()).toBeNull()
  })

  it("goForwardInApp returns the next entry after a back", () => {
    const { pushLocation } = useNavigationStore.getState()
    pushLocation("/a")
    pushLocation("/b")
    useNavigationStore.getState().goBackInApp()

    const target = useNavigationStore.getState().goForwardInApp()

    expect(target).toBe("/b")
    const state = useNavigationStore.getState()
    expect(state.currentIndex).toBe(1)
    expect(state.isRestoring).toBe(true)
  })

  it("goForwardInApp returns null at the top of the stack", () => {
    useNavigationStore.getState().pushLocation("/a")
    expect(useNavigationStore.getState().goForwardInApp()).toBeNull()
  })

  it("selectors report back/forward availability", () => {
    expect(selectCanGoBack(useNavigationStore.getState())).toBe(false)
    expect(selectCanGoForward(useNavigationStore.getState())).toBe(false)

    const { pushLocation } = useNavigationStore.getState()
    pushLocation("/a")
    pushLocation("/b")

    expect(selectCanGoBack(useNavigationStore.getState())).toBe(true)
    expect(selectCanGoForward(useNavigationStore.getState())).toBe(false)

    useNavigationStore.getState().goBackInApp()
    expect(selectCanGoBack(useNavigationStore.getState())).toBe(false)
    expect(selectCanGoForward(useNavigationStore.getState())).toBe(true)
  })
})
