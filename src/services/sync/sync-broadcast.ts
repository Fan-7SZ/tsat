// Single source of truth for "local data source changed → schedule a sync upload"
// and the inbound-write guard.
//
// Data sources (Dexie tables, Zustand persisted runtime fields) install
// listeners that call notifyChange() whenever a write happens. The sync layer
// registers a handler via setNotifyHandler() to receive these signals and
// drive its debounced flush.
//
// applyRemote (inbound sync) wraps its writes in withApplyingRemote() so the
// same listeners can skip during inbound, avoiding loop-back upload.

type NotifyHandler = () => void

let notifyHandler: NotifyHandler | null = null
let applyingRemoteDepth = 0

export function setNotifyHandler(handler: NotifyHandler | null): void {
  notifyHandler = handler
}

export function notifyChange(): void {
  notifyHandler?.()
}
/**
 * Based on function calling counter to check whether the current change is caused by remote applying or not.
 */
export function isInApplyRemote(): boolean {
  return applyingRemoteDepth > 0
}

export async function withApplyingRemote<T>(fn: () => Promise<T>): Promise<T> {
  applyingRemoteDepth += 1
  try {
    return await fn()
  } finally {
    applyingRemoteDepth -= 1
  }
}
