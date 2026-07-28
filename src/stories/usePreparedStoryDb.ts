import { useEffect, useState } from "react"

import { prepareTrackDb } from "@/persistence/db"

type StoryDbAction = () => Promise<void>

export function usePreparedStoryDb(
  setup: StoryDbAction,
  teardown: StoryDbAction
): boolean {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let disposed = false
    let setupCompleted = false

    const initialize = async () => {
      await prepareTrackDb()
      if (disposed) return

      await setup()
      setupCompleted = true

      if (disposed) {
        await teardown()
        return
      }

      setIsReady(true)
    }

    void initialize()

    return () => {
      disposed = true

      if (setupCompleted) {
        void teardown()
      }
    }
  }, [setup, teardown])

  return isReady
}
