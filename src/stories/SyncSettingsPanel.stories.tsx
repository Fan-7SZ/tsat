import type { Meta, StoryObj } from "@storybook/react-vite"

import { SyncSettingsPanel } from "@/components/dialogs/SyncDialog"
import type { SyncManager } from "@/services/sync/sync-manager"
import type { WorkerBackedSyncProvider } from "@/services/sync/sync-provider"
import type {
  SyncPanelErrorCode,
  SyncPanelStatus,
} from "@/services/sync/sync-panel-types"
import type {
  OccupiedStatus,
  SyncConnectionStatus,
  SyncProviderKind,
} from "@/services/sync/types"

// ── Worker-free mocks ──────────────────────────────────────
// The real panels need a live worker (OAuth + token exchange) that can't run in
// local dev, so these stories drive the presentational `SyncSettingsPanel` with
// an inert manager whose status is fixed per story. Mirrors the status → status
// derivations in WorkerBackedSyncProviderBase so the panel behaves authentically.

const noop = async () => {}

function connectionFor(status: SyncPanelStatus): SyncConnectionStatus {
  switch (status) {
    case "authorized":
      return "connected"
    case "authorizing":
    case "refreshing":
      return "connecting"
    case "unauthorized":
      return "disconnected"
  }
}

function occupiedFor(status: SyncPanelStatus): OccupiedStatus {
  switch (status) {
    case "authorized":
      return "occupied"
    case "refreshing":
    case "authorizing":
    case "unauthorized":
      return "available"
  }
}

function makeMockProvider(
  status: SyncPanelStatus,
  errorCode: SyncPanelErrorCode | null,
  providerKind: SyncProviderKind
): WorkerBackedSyncProvider {
  return {
    providerKind,
    getPanelStatus: () => status,
    getLastErrorCode: () => errorCode,
    getConnectionStatus: () => connectionFor(status),
    getOccupiedStatus: () => occupiedFor(status),
    setPanelStatusChangeHandler: () => {},
    clearRemoteCredential: noop,
    connect: noop,
    disconnect: noop,
    // Sync IO is never exercised by the panel; present to satisfy the interface.
    listDeviceDataFiles: async () => [],
    readDeviceData: async () => null,
    writeOwnDeviceData: noop,
    deleteAllDeviceData: noop,
  } satisfies WorkerBackedSyncProvider
}

function makeMockManager(
  status: SyncPanelStatus,
  opts: {
    errorCode?: SyncPanelErrorCode | null
    providerKind?: SyncProviderKind
  } = {}
): SyncManager {
  const errorCode = opts.errorCode ?? null
  const providerKind = opts.providerKind ?? "google-drive"
  const provider = makeMockProvider(status, errorCode, providerKind)

  return {
    start: noop,
    stop: noop,
    syncNow: noop,
    connect: noop,
    disconnect: noop,
    getStatus: () => "idle",
    getConnectionStatus: () => connectionFor(status),
    getOccupiedStatus: () => occupiedFor(status),
    getProviderKind: () => providerKind,
    getLastSyncedAt: () => null,
    getLastKnownHashData: () => null,
    getProvider: () => provider,
    getPanelStatus: () => status,
    getLastErrorCode: () => errorCode,
    getLastSyncError: () => null,
  } satisfies SyncManager
}

const meta = {
  title: "Components/SyncSettingsPanel",
  component: SyncSettingsPanel,
  parameters: {
    layout: "padded",
    docs: { story: { inline: false, iframeHeight: 760 } },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="mx-auto w-[32rem] max-w-full">
        <Story />
      </div>
    ),
  ],
  args: {
    selectedProvider: "google-drive",
    lastSyncedAt: "2026-06-26T01:38:00.000Z",
    onSelectProvider: () => {},
    manager: makeMockManager("unauthorized"),
  },
} satisfies Meta<typeof SyncSettingsPanel>

export default meta
type Story = StoryObj<typeof meta>

/** No provider chosen yet — only the provider selector is shown. */
export const NoProviderSelected: Story = {
  args: { selectedProvider: null, manager: null },
}

/** Bound provider, not yet connected — shows the "Authorize" call to action. */
export const Unauthorized: Story = {}

/** Authorize failed — same as unauthorized plus the error line. */
export const AuthorizationFailed: Story = {
  args: { manager: makeMockManager("unauthorized", { errorCode: "authorization_failed" }) },
}

/** OAuth popup/redirect in flight. */
export const Authorizing: Story = {
  args: { manager: makeMockManager("authorizing") },
}

/** Refreshing the worker session/token. */
export const Refreshing: Story = {
  args: { manager: makeMockManager("refreshing") },
}

/** Fully connected — danger zone and the last-synced / sync-now controls. */
export const Authorized: Story = {
  args: { manager: makeMockManager("authorized") },
}

/** Connected but a sync call is failing. */
export const AuthorizedSyncUnavailable: Story = {
  args: {
    manager: makeMockManager("authorized", { errorCode: "sync_unavailable" }),
  },
}

/** OneDrive provider, connected, to verify provider-specific copy. */
export const OneDriveAuthorized: Story = {
  args: {
    selectedProvider: "onedrive",
    manager: makeMockManager("authorized", { providerKind: "onedrive" }),
  },
}
