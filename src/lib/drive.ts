import { authenticatedFetch } from './authTransport'

export type GoogleDriveStatus = {
  configured: boolean
  email: string | null
  displayName: string | null
  expiresAt?: string | null
  provider: string
  url?: string
}

export async function getGoogleDriveStatus(): Promise<GoogleDriveStatus> {
  const response = await authenticatedFetch('/api/drive/auth')
  const payload = (await response.json().catch(() => ({}))) as GoogleDriveStatus & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? `Could not load Google Drive status (${response.status})`)
  return payload
}

export async function startGoogleDriveAuth(): Promise<GoogleDriveStatus> {
  const response = await authenticatedFetch('/api/drive/auth', { method: 'POST' })
  const payload = (await response.json().catch(() => ({}))) as GoogleDriveStatus & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? `Could not start Google Drive OAuth (${response.status})`)
  return payload
}

export async function disconnectGoogleDrive(): Promise<GoogleDriveStatus> {
  const response = await authenticatedFetch('/api/drive/auth', { method: 'DELETE' })
  const payload = (await response.json().catch(() => ({}))) as GoogleDriveStatus & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? `Could not disconnect Google Drive (${response.status})`)
  return payload
}
