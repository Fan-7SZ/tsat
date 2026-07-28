export const SYNC_REFRESH_TOKEN_STORAGE_KEY = "sync.auth.refresh_token"
export const SYNC_ACCESS_TOKEN_STORAGE_KEY = "sync.auth.access_token"

export interface SyncAccessToken {
  accessToken: string
  expiresAt: string
}

function parseStoredRefreshToken(
  raw: string | null
): { provider: string; refreshToken: string } | null {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as {
      provider?: string
      refreshToken?: string
    }
    if (!parsed.provider || !parsed.refreshToken) {
      return null
    }
    return { provider: parsed.provider, refreshToken: parsed.refreshToken }
  } catch {
    return null
  }
}

/**
 * Reads the client-stored refresh token for the given provider. The refresh
 * token is the sole credential now: possessing it is what keeps this device
 * connected. Returns null if absent or stored for a different provider.
 */
export function readSyncRefreshToken(provider: string): string | null {
  if (typeof window === "undefined") {
    return null
  }

  const parsedToken = parseStoredRefreshToken(
    window.localStorage.getItem(SYNC_REFRESH_TOKEN_STORAGE_KEY)
  )
  return parsedToken?.provider === provider ? parsedToken.refreshToken : null
}

/**
 * True when a storage change to the refresh-token key only swapped the token
 * value for the same provider — i.e. a rotation write (OneDrive rotates the
 * refresh token on every refresh). Other windows must not rebuild their sync
 * manager for those; they pick up the rotated token inside the refresh lock.
 * Binding changes (connect / disconnect / provider switch) return false.
 */
export function isRefreshTokenRotation(
  oldRaw: string | null,
  newRaw: string | null
): boolean {
  const oldToken = parseStoredRefreshToken(oldRaw)
  const newToken = parseStoredRefreshToken(newRaw)
  return (
    oldToken !== null &&
    newToken !== null &&
    oldToken.provider === newToken.provider
  )
}

export function saveSyncRefreshToken(
  provider: string,
  refreshToken: string
): void {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(
    SYNC_REFRESH_TOKEN_STORAGE_KEY,
    JSON.stringify({ provider, refreshToken })
  )
}

export function clearSyncRefreshToken(_provider?: string): void {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(SYNC_REFRESH_TOKEN_STORAGE_KEY)
}

export function readSyncAccessToken(provider: string): SyncAccessToken | null {
  if (typeof window === "undefined") {
    return null
  }

  const rawToken = window.localStorage.getItem(SYNC_ACCESS_TOKEN_STORAGE_KEY)
  if (!rawToken) {
    return null
  }

  try {
    const parsedToken = JSON.parse(rawToken) as {
      provider: string
      accessToken: string
      expiresAt: string
    }

    if (parsedToken.provider !== provider) {
      return null
    }

    return {
      accessToken: parsedToken.accessToken,
      expiresAt: parsedToken.expiresAt,
    }
  } catch {
    return null
  }
}

export function saveSyncAccessToken(
  provider: string,
  accessToken: SyncAccessToken
): void {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(
    SYNC_ACCESS_TOKEN_STORAGE_KEY,
    JSON.stringify({ provider, ...accessToken })
  )
}

export function clearSyncAccessToken(_provider?: string): void {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(SYNC_ACCESS_TOKEN_STORAGE_KEY)
}
