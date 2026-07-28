import { useEffect } from "react"
import { useLocation } from "react-router"

export function ScrollToHash() {
  useScrollToHash()
  return null
}

function useScrollToHash() {
  const location = useLocation()

  useEffect(() => {
    if (!location.hash) return

    const id = decodeURIComponent(location.hash.slice(1))
    const element = document.getElementById(id)

    if (!element) return

    element.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }, [location])
}
