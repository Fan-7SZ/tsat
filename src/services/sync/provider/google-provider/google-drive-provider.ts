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

const GOOGLE_DRIVE_API_BASE_URL = "https://www.googleapis.com/drive/v3"
const GOOGLE_DRIVE_UPLOAD_API_BASE_URL =
  "https://www.googleapis.com/upload/drive/v3"

const driveFileSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  md5Checksum: z.string().optional(),
})

const driveFileListSchema = z.object({
  files: z.array(driveFileSchema).default([]),
})

const googleDriveErrorSchema = z.object({
  error: z.object({
    code: z.number().optional(),
    message: z.string().optional(),
    errors: z
      .array(
        z.object({
          reason: z.string().optional(),
          message: z.string().optional(),
        })
      )
      .optional(),
  }),
})

export class GoogleDriveProvider extends WorkerBackedSyncProviderBase {
  // Cache of file name → file id, primed by listing / writing.
  private fileIdByName: Record<string, string> = {}

  constructor() {
    super("google", "google-drive")
  }

  protected async listDeviceFiles(): Promise<DeviceFileRef[]> {
    const url = new URL(`${GOOGLE_DRIVE_API_BASE_URL}/files`)
    url.searchParams.set("spaces", "appDataFolder")
    url.searchParams.set("pageSize", "1000")
    url.searchParams.set("fields", "files(id,name,md5Checksum)")
    url.searchParams.set(
      "q",
      `name contains '${DEVICE_DATA_FILE_PREFIX}' and trashed = false`
    )

    const response = await this.requestGoogleDriveApi(url.toString())
    const json = await this.parseJsonResponse(response)
    const payload = driveFileListSchema.safeParse(json)
    if (!payload.success) {
      throw new WorkerAuthError(
        "invalid_worker_response",
        "Google Drive file list response was invalid"
      )
    }

    const refs: DeviceFileRef[] = []
    for (const file of payload.data.files) {
      const name = file.name ?? ""
      const deviceId = parseDeviceIdFromFileName(name)
      if (!deviceId) continue
      this.fileIdByName[name] = file.id
      refs.push({ deviceId, fileId: file.id, changeToken: file.md5Checksum })
    }
    return refs
  }

  protected async readDeviceFileById(fileId: string): Promise<unknown | null> {
    const url = new URL(`${GOOGLE_DRIVE_API_BASE_URL}/files/${fileId}`)
    url.searchParams.set("alt", "media")
    const response = await this.requestGoogleDriveApi(url.toString(), {
      headers: { Accept: "application/json" },
    })
    if (response.status === 404) {
      return null
    }
    return this.parseJsonResponse(response)
  }

  protected async writeDeviceFileByName(
    fileName: string,
    body: string
  ): Promise<void> {
    const fileId = await this.findFileIdByName(fileName)
    if (!fileId) {
      await this.createDriveFile(fileName, body)
      return
    }
    const updated = await this.updateDriveFile(fileName, fileId, body)
    if (!updated) {
      await this.createDriveFile(fileName, body)
    }
  }

  protected async deleteDeviceFileById(fileId: string): Promise<void> {
    await this.requestGoogleDriveApi(
      `${GOOGLE_DRIVE_API_BASE_URL}/files/${fileId}`,
      { method: "DELETE" }
    )
    for (const [name, id] of Object.entries(this.fileIdByName)) {
      if (id === fileId) delete this.fileIdByName[name]
    }
  }

  protected clearCachedRemoteFiles(): void {
    this.fileIdByName = {}
  }

  protected async readErrorCode(response: Response): Promise<string> {
    const json = await response.json().catch(() => null)
    const errorPayload = googleDriveErrorSchema.safeParse(json)
    if (!errorPayload.success) {
      if (response.status === 401) {
        return "reauthorization_required"
      }
      return "drive_request_failed"
    }

    const reasons = errorPayload.data.error.errors?.map(
      (entry) => entry.reason ?? ""
    )

    if (response.status === 401) {
      return "reauthorization_required"
    }

    if (
      response.status === 403 &&
      reasons?.some((reason) =>
        [
          "accessNotConfigured",
          "appNotAuthorizedToFile",
          "authError",
          "forbidden",
          "insufficientFilePermissions",
        ].includes(reason)
      )
    ) {
      return "drive_access_denied"
    }

    return "drive_request_failed"
  }

  private async findFileIdByName(fileName: string): Promise<string | null> {
    const cached = this.fileIdByName[fileName]
    if (cached) return cached

    const url = new URL(`${GOOGLE_DRIVE_API_BASE_URL}/files`)
    url.searchParams.set("spaces", "appDataFolder")
    url.searchParams.set("pageSize", "1")
    url.searchParams.set("fields", "files(id)")
    url.searchParams.set("q", `name = '${fileName}' and trashed = false`)

    const response = await this.requestGoogleDriveApi(url.toString())
    const json = await this.parseJsonResponse(response)
    const payload = driveFileListSchema.safeParse(json)
    if (!payload.success) {
      throw new WorkerAuthError(
        "invalid_worker_response",
        "Google Drive file lookup response was invalid"
      )
    }
    const fileId = payload.data.files[0]?.id ?? null
    if (fileId) this.fileIdByName[fileName] = fileId
    return fileId
  }

  private async createDriveFile(fileName: string, body: string): Promise<void> {
    const boundary = `track-sync-${crypto.randomUUID()}`
    const metadata = JSON.stringify({
      name: fileName,
      parents: ["appDataFolder"],
      mimeType: "application/json",
    })
    const multipartBody = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      metadata,
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      body,
      `--${boundary}--`,
      "",
    ].join("\r\n")

    const url = new URL(`${GOOGLE_DRIVE_UPLOAD_API_BASE_URL}/files`)
    url.searchParams.set("uploadType", "multipart")
    url.searchParams.set("fields", "id")

    const response = await this.requestGoogleDriveApi(url.toString(), {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: multipartBody,
    })

    const json = await this.parseJsonResponse(response)
    const payload = driveFileSchema.safeParse(json)
    if (!payload.success) {
      throw new WorkerAuthError(
        "invalid_worker_response",
        "Google Drive file creation response was invalid"
      )
    }
    this.fileIdByName[fileName] = payload.data.id
  }

  private async updateDriveFile(
    fileName: string,
    fileId: string,
    body: string
  ): Promise<boolean> {
    const url = new URL(`${GOOGLE_DRIVE_UPLOAD_API_BASE_URL}/files/${fileId}`)
    url.searchParams.set("uploadType", "media")

    const response = await this.requestGoogleDriveApi(url.toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body,
    })

    if (response.status === 404) {
      delete this.fileIdByName[fileName]
      return false
    }
    this.fileIdByName[fileName] = fileId
    return true
  }

  /**
   * Google Drive tolerates 404 at every call site (read/find/create/update all
   * inspect the 404 themselves), so it always passes `allow404: true`.
   */
  private requestGoogleDriveApi(
    url: string,
    init: RequestInit = {}
  ): Promise<Response> {
    return this.authorizedFetch(url, init, { allow404: true })
  }
}
