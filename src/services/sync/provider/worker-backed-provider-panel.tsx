import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/components/shared/language-provider"
import { useSyncStore } from "@/store/sync-store"
import {
  SettingField,
  SettingFieldTitle,
  SettingFieldDescription,
} from "@/components/shared/setting-field"
import type { SyncProviderPanelContext, WorkerBackedSyncProvider } from "../sync-provider"
import type { SyncPanelErrorCode, SyncPanelStatus } from "../sync-panel-types"

type Translations = ReturnType<typeof useLanguage>["t"]
type ProviderLabels = Translations["sync"]["googleDrive"]

/**
 * Shared panel for worker-backed providers (Google Drive, OneDrive). Renders the
 * connect/disconnect section. The refresh token is stored client-side, so once a
 * device authorizes there is no further passphrase step. i18n namespace is
 * selected from `provider.providerKind`.
 */
export function WorkerBackedProviderPanel({
  provider,
  context,
}: {
  provider: WorkerBackedSyncProvider
  context: SyncProviderPanelContext
}) {
  const [pendingStatus, setPendingStatus] = useState<SyncPanelStatus | null>(
    null
  )
  const [isClearingRemote, setIsClearingRemote] = useState(false)
  const [clearRemoteError, setClearRemoteError] = useState<string | null>(null)
  const { t } = useLanguage()
  const labels = resolveLabels(provider.providerKind, t)
  // Subscribe to the store fields only as a re-render signal; read the live
  // value from the provider (the source of truth) so it can't drift after a
  // manager rebuild. See useSyncPanelStatus in sync-store for the rationale.
  useSyncStore((s) => s.panelStatus)
  useSyncStore((s) => s.panelErrorCode)
  const status = provider.getPanelStatus()
  const panelErrorCode = provider.getLastErrorCode()
  const panelError = panelErrorCode
    ? getPanelErrorMessage(panelErrorCode, labels)
    : null
  const displayStatus = pendingStatus ?? status
  const isBusy =
    pendingStatus !== null ||
    status === "authorizing" ||
    status === "refreshing"
  const isAuthorized = status === "authorized"

  const handleClick = async () => {
    try {
      if (isAuthorized) {
        setPendingStatus("unauthorized")
        await context.disconnect()
      } else {
        setPendingStatus("authorizing")
        await context.connect()
      }
    } finally {
      setPendingStatus(null)
    }
  }

  const handleClearRemoteCredential = async () => {
    setClearRemoteError(null)
    if (!window.confirm(t.sync.dangerZone.confirm(labels.title))) {
      return
    }

    setIsClearingRemote(true)
    try {
      await provider.clearRemoteCredential()
    } catch {
      setClearRemoteError(t.sync.dangerZone.errorFailed)
    } finally {
      setIsClearingRemote(false)
    }
  }

  const buttonLabel =
    pendingStatus === "unauthorized"
      ? labels.buttonLabels.disconnecting
      : getButtonLabel(displayStatus, labels)

  return (
    <>
      <SettingField>
        <SettingFieldTitle>{labels.title}</SettingFieldTitle>
        <SettingFieldDescription>
          {getDescription(displayStatus, labels)}
        </SettingFieldDescription>
        {panelError && (
          <SettingFieldDescription variant="destructive">
            {panelError}
          </SettingFieldDescription>
        )}
        <Button
          type="button"
          variant={isAuthorized ? "destructive" : "default"}
          disabled={isBusy || isClearingRemote}
          onClick={handleClick}
          className="mt-1.5"
        >
          {buttonLabel}
        </Button>
      </SettingField>
      {isAuthorized && (
        <SettingField className="mt-4 border-t border-border pt-4">
          <SettingFieldTitle>{t.sync.dangerZone.title}</SettingFieldTitle>
          <SettingFieldDescription>
            {t.sync.dangerZone.description}
          </SettingFieldDescription>
          <div className="mt-1.5 flex flex-col">
            <Button
              type="button"
              variant="destructive"
              disabled={isBusy || isClearingRemote}
              onClick={handleClearRemoteCredential}
            >
              {isClearingRemote
                ? t.sync.dangerZone.actionInProgress
                : t.sync.dangerZone.action}
            </Button>
            {clearRemoteError && (
              <SettingFieldDescription variant="destructive" className="mt-2">
                {clearRemoteError}
              </SettingFieldDescription>
            )}
          </div>
        </SettingField>
      )}
    </>
  )
}

function resolveLabels(
  providerKind: WorkerBackedSyncProvider["providerKind"],
  t: Translations
): ProviderLabels {
  return providerKind === "google-drive" ? t.sync.googleDrive : t.sync.oneDrive
}

function getButtonLabel(status: SyncPanelStatus, labels: ProviderLabels): string {
  switch (status) {
    case "authorized":
      return labels.buttonLabels.disconnect
    case "authorizing":
      return labels.buttonLabels.authorizing
    case "refreshing":
      return labels.buttonLabels.refreshing
    case "unauthorized":
      return labels.buttonLabels.authorize
  }
}

function getDescription(status: SyncPanelStatus, labels: ProviderLabels): string {
  switch (status) {
    case "authorized":
      return labels.statusDescriptions.authorized
    case "authorizing":
      return labels.statusDescriptions.authorizing
    case "refreshing":
      return labels.statusDescriptions.refreshing
    case "unauthorized":
      return labels.statusDescriptions.unauthorized
  }
}

function getPanelErrorMessage(
  errorCode: SyncPanelErrorCode,
  labels: ProviderLabels
): string {
  switch (errorCode) {
    case "authorization_failed":
      return labels.errors.authorizationFailed
    case "sync_unavailable":
      return labels.errors.syncUnavailable
  }
}
