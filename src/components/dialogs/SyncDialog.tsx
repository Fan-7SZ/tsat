import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/components/shared/language-provider"
import { useSyncStore } from "@/store/sync-store"
import {
  SettingField,
  SettingFieldTitle,
  SettingFieldDescription,
} from "@/components/shared/setting-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"
import {
  SYNC_PROVIDER_KINDS,
  type SyncProviderKind,
} from "@/services/sync/types"
import type { SyncManager } from "@/services/sync/sync-manager"
import { isWorkerBackedProvider } from "@/services/sync/sync-provider"
import { WorkerBackedProviderPanel } from "@/services/sync/provider/worker-backed-provider-panel"
import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"

export function SyncDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const selectedProvider = useSyncStore((s) => s.syncProviderKind)
  const manager = useSyncStore((s) => s.syncManager)
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt)
  const selectSyncProvider = useSyncStore((s) => s.selectSyncProvider)
  useSyncStore((s) => s.panelStatus)

  return (
    <SyncDialogView
      open={open}
      onOpenChange={onOpenChange}
      selectedProvider={selectedProvider}
      manager={manager}
      lastSyncedAt={lastSyncedAt}
      onSelectProvider={selectSyncProvider}
    />
  )
}

export function SyncDialogView({
  open,
  onOpenChange,
  ...panelProps
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
} & SyncSettingsPanelProps) {
  const { t } = useLanguage()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.sync.title}</DialogTitle>
        </DialogHeader>

        <SyncSettingsPanel {...panelProps} />
      </DialogContent>
    </Dialog>
  )
}

interface SyncSettingsPanelProps {
  selectedProvider: SyncProviderKind | null
  manager: SyncManager | null
  lastSyncedAt: string | null
  onSelectProvider: (kind: SyncProviderKind | null) => void
}

/**
 * Dialog-less body of the sync settings. Rendered inside SyncDialog as well as
 * the Sync tab of SettingsDialog.
 */
export function SyncSettingsPanel({
  selectedProvider,
  manager,
  lastSyncedAt,
  onSelectProvider,
}: SyncSettingsPanelProps) {
  const { language, t } = useLanguage()
  const [isSyncingNow, setIsSyncingNow] = useState(false)
  const isProviderConfigured =
    selectedProvider !== null && manager?.getProviderKind() === selectedProvider
  const isProviderConnected =
    isProviderConfigured && manager.getConnectionStatus() === "connected"

  // The UI owns the provider → panel mapping so the service layer stays
  // React-free (a provider importing its panel created an import cycle).
  const provider = isProviderConfigured ? manager.getProvider() : null
  const providerPanel = isWorkerBackedProvider(provider) ? (
    <WorkerBackedProviderPanel
      provider={provider}
      context={{
        connect: () => manager!.connect(),
        disconnect: () => manager!.disconnect(),
      }}
    />
  ) : null
  const showProviderPanel = selectedProvider !== null && providerPanel !== null

  const selectDisabled = isProviderConfigured
    ? manager.getOccupiedStatus() === "occupied"
    : false

  const canSyncNow = isProviderConnected && !isSyncingNow

  const handleSyncNow = async () => {
    if (!manager || !canSyncNow) return

    setIsSyncingNow(true)
    try {
      await manager.syncNow()
      if (manager.getStatus() === "error") {
        toast.error(t.sync.syncNowFailed, {
          description: manager.getLastSyncError() ?? undefined,
        })
      }
    } finally {
      setIsSyncingNow(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <SettingField>
        <SettingFieldTitle>{t.sync.providerLabel}</SettingFieldTitle>
        <SettingFieldDescription>
          {selectDisabled ? t.sync.providerLockedHelp : t.sync.providerHelp}
        </SettingFieldDescription>
        <Select
          disabled={selectDisabled}
          value={selectedProvider || "none"}
          onValueChange={(value) => {
            if (value === "none") {
              onSelectProvider(null)
            } else {
              onSelectProvider(value as SyncProviderKind)
            }
          }}
        >
          <SelectTrigger className="w-full" disabled={selectDisabled}>
            <SelectValue placeholder={t.sync.providerPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t.sync.providerNone}</SelectItem>
            {SYNC_PROVIDER_KINDS.map((provider) => (
              <SelectItem key={provider} value={provider}>
                {getProviderLabel(provider, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingField>
      {showProviderPanel && (
        <div className="flex flex-col gap-4 border-t border-border pt-4">
          {providerPanel}
        </div>
      )}
      {isProviderConnected && (
        <div className="flex flex-col items-start gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="paragraph-small-medium">{t.sync.autoSync}</span>
            <p className="paragraph-mini text-muted-foreground">
              {t.sync.lastSynced}: {formatLastSyncedAt(lastSyncedAt, language, t)}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!canSyncNow}
            onClick={handleSyncNow}
          >
            <RefreshCw className={isSyncingNow ? "animate-spin" : undefined} />
            {isSyncingNow ? t.sync.syncingNow : t.sync.syncNow}
          </Button>
        </div>
      )}
    </section>
  )
}

/** Store-connected sync settings body for embedding in SettingsDialog. */
export function SyncSettings() {
  const selectedProvider = useSyncStore((s) => s.syncProviderKind)
  const manager = useSyncStore((s) => s.syncManager)
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt)
  const selectSyncProvider = useSyncStore((s) => s.selectSyncProvider)
  useSyncStore((s) => s.panelStatus)

  return (
    <SyncSettingsPanel
      selectedProvider={selectedProvider}
      manager={manager}
      lastSyncedAt={lastSyncedAt}
      onSelectProvider={selectSyncProvider}
    />
  )
}

function formatLastSyncedAt(
  timestamp: string | null,
  language: "en" | "zh",
  t: ReturnType<typeof useLanguage>["t"]
): string {
  if (!timestamp) return t.sync.neverSynced

  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return t.sync.unknownTime

  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function getProviderLabel(
  provider: SyncProviderKind,
  t: ReturnType<typeof useLanguage>["t"]
): string {
  switch (provider) {
    case "google-drive":
      return t.sync.providerGoogleDrive
    case "onedrive":
      return t.sync.providerOneDrive
    default:
      return provider
  }
}
