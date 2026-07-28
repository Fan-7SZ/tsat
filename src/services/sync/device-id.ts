const DEVICE_ID_KEY = "track-device-id"
const DATA_FILE_PREFIX = "track-sync-data-"
const DATA_FILE_SUFFIX = ".json"

/**
 * Stable per-browser-profile id. Each device is the sole writer of its own
 * `track-sync-data-<deviceId>.json` file, so cross-device write contention (and
 * thus lost updates) cannot occur. Persisted in localStorage; survives auth
 * disconnect (it is a device identity, not a credential).
 */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

export function deviceDataFileName(deviceId: string): string {
  return `${DATA_FILE_PREFIX}${deviceId}${DATA_FILE_SUFFIX}`
}

export function isDeviceDataFileName(name: string): boolean {
  return name.startsWith(DATA_FILE_PREFIX) && name.endsWith(DATA_FILE_SUFFIX)
}

export function parseDeviceIdFromFileName(name: string): string | null {
  if (!isDeviceDataFileName(name)) return null
  return name.slice(DATA_FILE_PREFIX.length, name.length - DATA_FILE_SUFFIX.length)
}

/** Query fragment matching all device data files (provider listing). */
export const DEVICE_DATA_FILE_PREFIX = DATA_FILE_PREFIX
