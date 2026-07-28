import { useEffect, useState } from "react"

import { prepareTrackDb } from "@/persistence/db"

type StoryDbAction = () => Promise<void>

// Stories share one database, and Storybook unmounts the previous story
// before mounting the next one. Both seeding and cleanup are async, so
// without ordering the outgoing story's teardown can land *after* the
// incoming story's setup and delete the rows it just wrote — the next story
// then renders against an empty table. Chaining every action through a single
// queue preserves unmount-then-mount order, whatever the machine's speed.
let dbActionQueue: Promise<void> = Promise.resolve()

function enqueueDbAction(action: StoryDbAction): Promise<void> {
  const next = dbActionQueue.then(action, action)
  // A failing action must not poison the queue for later stories.
  dbActionQueue = next.catch(() => {})
  return next
}

export function usePreparedStoryDb(
  setup: StoryDbAction,
  teardown: StoryDbAction
): boolean {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let disposed = false
    let setupCompleted = false

    const initialize = async () => {
      await enqueueDbAction(async () => {
        await prepareTrackDb()
        if (disposed) return
        await setup()
        if (disposed) {
          // Unmounted while seeding: the cleanup already ran and saw no
          // completed setup, so undo it here — still inside the queue.
          await teardown()
          return
        }
        setupCompleted = true
      })

      if (disposed) return
      setIsReady(true)
    }

    void initialize()

    return () => {
      disposed = true

      if (setupCompleted) {
        void enqueueDbAction(teardown)
      }
    }
  }, [setup, teardown])

  return isReady
}
