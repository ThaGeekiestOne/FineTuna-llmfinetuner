import { authenticatedFetch } from './authTransport'

export type GoogleDriveStatus = {
  configured: boolean
  email: string | null
  displayName: string | null
  expiresAt?: string | null
  provider: string
  url?: string
}

const googleDriveOAuthStateKey = 'finetuna_google_drive_oauth_state'

export async function getGoogleDriveStatus(): Promise<GoogleDriveStatus> {
  const response = await authenticatedFetch('/api/drive/auth')
  const payload = (await response.json().catch(() => ({}))) as GoogleDriveStatus & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? `Could not load Google Drive status (${response.status})`)
  return payload
}

export function createGoogleDriveOAuthRequest() {
  const state = createRandomHex(32)
  const redirectUri = `${window.location.origin}/drive/callback`
  window.localStorage.setItem(googleDriveOAuthStateKey, state)
  return { state, redirectUri }
}

export function consumeGoogleDriveOAuthState(state: string) {
  const expected = window.localStorage.getItem(googleDriveOAuthStateKey) ?? ''
  window.localStorage.removeItem(googleDriveOAuthStateKey)
  return Boolean(expected && state && expected === state)
}

export async function startGoogleDriveAuth(input: { state: string; redirectUri: string }): Promise<GoogleDriveStatus> {
  const response = await authenticatedFetch('/api/drive/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as GoogleDriveStatus & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? `Could not start Google Drive OAuth (${response.status})`)
  return payload
}

export async function completeGoogleDriveAuth(input: { code: string; redirectUri: string }): Promise<GoogleDriveStatus> {
  const response = await authenticatedFetch('/api/drive/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as GoogleDriveStatus & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? `Could not complete Google Drive OAuth (${response.status})`)
  return payload
}

export async function disconnectGoogleDrive(): Promise<GoogleDriveStatus> {
  const response = await authenticatedFetch('/api/drive/auth', { method: 'DELETE' })
  const payload = (await response.json().catch(() => ({}))) as GoogleDriveStatus & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? `Could not disconnect Google Drive (${response.status})`)
  return payload
}

function createRandomHex(byteLength: number) {
  const values = new Uint8Array(byteLength)
  window.crypto.getRandomValues(values)
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('')
}
