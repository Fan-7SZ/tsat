import type { DeviceFileRef } from "../../types"
import { z } from "zod"
import {
  WorkerAuthError,
  WorkerBackedSyncProviderBase,
} from "../worker-backed-sync-provider"
import {
  DEVICE_DATA_FILE_PREFIX,
  parseDeviceIdFromFileName,
} from "../../device-id"

const MICROSOFT_GRAPH_API_BASE_URL = "https://graph.microsoft.com/v1.0"

const driveItemSchema = z.object({
  id: z.string().min(1),
})

const driveItemDownloadMetadataSchema = z.object({
  id: z.string().min(1),
  "@microsoft.graph.downloadUrl": z.string().min(1).optional(),
})

const appRootSchema = z.object({
  id: z.string().min(1),
})

const driveItemListSchema = z.object({
  value: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        eTag: z.string().optional(),
      })
    )
    .default([]),
})

const graphErrorSchema = z.object({
  error: z.object({
    code: z.string().optional(),
    message: z.string().optional(),
  }),
})

export class OneDriveProvider extends WorkerBackedSyncProviderBase {
  private appRootId: string | null = null
  private fileIdByName: Record<string, string> = {}

  constructor() {
    super("onedrive", "onedrive")
  }

  protected async listDeviceFiles(): Promise<DeviceFileRef[]> {
    const url = new URL(
      `${MICROSOFT_GRAPH_API_BASE_URL}/me/drive/special/approot/children`
    )
    url.searchParams.set("$select", "id,name,eTag")
    url.searchParams.set("$top", "1000")

    const response = await this.requestMicrosoftGraphApi(url.toString())
    const json = await this.parseJsonResponse(response)
    const payload = driveItemListSchema.safeParse(json)
    if (!payload.success) {
      throw new WorkerAuthError(
        "invalid_worker_response",
        "OneDrive file list response was invalid"
      )
    }

    const refs: DeviceFileRef[] = []
    for (const entry of payload.data.value) {
      if (!entry.name.startsWith(DEVICE_DATA_FILE_PREFIX)) continue
      const deviceId = parseDeviceIdFromFileName(entry.name)
      if (!deviceId) continue
      this.fileIdByName[entry.name] = entry.id
      refs.push({ deviceId, fileId: entry.id, changeToken: entry.eTag })
    }
    return refs
  }

  protected async readDeviceFileById(fileId: string): Promise<unknown | null> {
    const downloadUrl = await this.resolveDownloadUrl(fileId)
    if (!downloadUrl) {
      return null
    }
    const response = await fetch(downloadUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    if (response.status === 404) {
      return null
    }
    if (!response.ok) {
      throw new WorkerAuthError(
        "drive_request_failed",
        `OneDrive download failed: ${response.status}`
      )
    }
    return this.parseJsonResponse(response)
  }

  protected async writeDeviceFileByName(
    fileName: string,
    body: string
  ): Promise<void> {
    const appRootId = await this.getAppRootId()
    const url = `${MICROSOFT_GRAPH_API_BASE_URL}/me/drive/items/${appRootId}:/${fileName}:/content`
    const response = await this.requestMicrosoftGraphApi(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body,
    })

    const json = await this.parseJsonResponse(response)
    const payload = driveItemSchema.safeParse(json)
    if (!payload.success) {
      throw new WorkerAuthError(
        "invalid_worker_response",
        "OneDrive file write response was invalid"
      )
    }
    this.fileIdByName[fileName] = payload.data.id
  }

  protected async deleteDeviceFileById(fileId: string): Promise<void> {
    await this.requestMicrosoftGraphApi(
      `${MICROSOFT_GRAPH_API_BASE_URL}/me/drive/items/${fileId}`,
      { method: "DELETE" },
      true
    )
    for (const [name, id] of Object.entries(this.fileIdByName)) {
      if (id === fileId) delete this.fileIdByName[name]
    }
  }

  protected clearCachedRemoteFiles(): void {
    this.appRootId = null
    this.fileIdByName = {}
  }

  protected async readErrorCode(response: Response): Promise<string> {
    const json = await response.json().catch(() => null)
    const errorPayload = graphErrorSchema.safeParse(json)
    if (!errorPayload.success) {
      if (response.status === 401) {
        return "reauthorization_required"
      }
      return "drive_request_failed"
    }

    const graphCode = errorPayload.data.error.code ?? ""

    if (response.status === 401) {
      return "reauthorization_required"
    }

    if (
      response.status === 403 &&
      ["accessDenied", "notAllowed", "insufficient_claims"].includes(graphCode)
    ) {
      return "drive_access_denied"
    }

    return "drive_request_failed"
  }

  private async getAppRootId(): Promise<string> {
    if (this.appRootId) {
      return this.appRootId
    }

    const response = await this.requestMicrosoftGraphApi(
      `${MICROSOFT_GRAPH_API_BASE_URL}/me/drive/special/approot`
    )
    const json = await this.parseJsonResponse(response)
    const payload = appRootSchema.safeParse(json)
    if (!payload.success) {
      throw new WorkerAuthError(
        "invalid_worker_response",
        "OneDrive app root response was invalid"
      )
    }
    this.appRootId = payload.data.id
    return payload.data.id
  }

  private async resolveDownloadUrl(fileId: string): Promise<string | null> {
    const selected = await this.readFileMetadata(fileId, true)
    if (selected === null) return null
    if (selected.downloadUrl) return selected.downloadUrl

    const fallback = await this.readFileMetadata(fileId, false)
    if (fallback === null) return null
    if (fallback.downloadUrl) return fallback.downloadUrl

    throw new WorkerAuthError(
      "invalid_worker_response",
      "OneDrive file metadata did not include @microsoft.graph.downloadUrl"
    )
  }

  private async readFileMetadata(
    fileId: string,
    useSelect: boolean
  ): Promise<{ id: string; downloadUrl: string | null } | null> {
    const url = new URL(
      `${MICROSOFT_GRAPH_API_BASE_URL}/me/drive/items/${fileId}`
    )
    if (useSelect) {
      url.searchParams.set("$select", "id,name,@microsoft.graph.downloadUrl")
    }
    url.searchParams.set("_ts", Date.now().toString())

    const response = await this.requestMicrosoftGraphApi(
      url.toString(),
      {
        headers: {
          Accept: "application/json",
          Prefer: 'odata.include-annotations="*"',
        },
      },
      true
    )

    if (response.status === 404) {
      return null
    }

    const json = await this.parseJsonResponse(response)
    const payload = driveItemDownloadMetadataSchema.safeParse(json)
    if (!payload.success) {
      throw new WorkerAuthError(
        "invalid_worker_response",
        "OneDrive file metadata response was invalid"
      )
    }

    return {
      id: payload.data.id,
      downloadUrl: payload.data["@microsoft.graph.downloadUrl"] ?? null,
    }
  }

  private requestMicrosoftGraphApi(
    url: string,
    init: RequestInit = {},
    allow404 = false
  ): Promise<Response> {
    return this.authorizedFetch(url, { cache: "no-store", ...init }, { allow404 })
  }
}
