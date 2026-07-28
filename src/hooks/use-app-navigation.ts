import { useNavigate } from "react-router"
import {
  useNavigationStore,
  selectCanGoBack,
  selectCanGoForward,
} from "@/store/navigation-store"

export function useAppNavigation() {
  const navigate = useNavigate()
  const canGoBack = useNavigationStore(selectCanGoBack)
  const canGoForward = useNavigationStore(selectCanGoForward)
  const goBackInApp = useNavigationStore((s) => s.goBackInApp)
  const goForwardInApp = useNavigationStore((s) => s.goForwardInApp)

  const goBack = () => {
    const target = goBackInApp()
    if (target) navigate(target)
  }

  const goForward = () => {
    const target = goForwardInApp()
    if (target) navigate(target)
  }

  return { goBack, goForward, canGoBack, canGoForward }
}
