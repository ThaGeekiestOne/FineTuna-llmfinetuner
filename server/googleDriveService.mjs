import { createHash, randomBytes } from 'node:crypto'
import { deleteGoogleDriveConnection, getGoogleDriveConnection, saveGoogleDriveConnection } from './googleDriveStore.mjs'

const scope = 'https://www.googleapis.com/auth/drive.readonly'
const authBase = 'https://accounts.google.com/o/oauth2/v2/auth'
const tokenUrl = 'https://oauth2.googleapis.com/token'
const driveFilesUrl = 'https://www.googleapis.com/drive/v3/files'
const driveAboutUrl = 'https://www.googleapis.com/drive/v3/about'

export async function getGoogleDriveStatus(userId = '', accessToken = '') {
  const connection = await getGoogleDriveConnection(userId, accessToken)
  return {
    configured: Boolean(connection?.refreshToken),
    email: connection?.email ?? null,
    displayName: connection?.displayName ?? null,
    expiresAt: connection?.expiresAt ?? null,
    provider: 'google_drive',
  }
}

export function createGoogleDriveAuthState(userId) {
  const nonce = randomBytes(16).toString('hex')
  const digest = createHash('sha256').update(`${userId}:${nonce}`).digest('hex')
  return `${nonce}.${digest}`
}

export function buildGoogleDriveAuthUrl(state, redirectUri) {
  const search = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope,
    state,
  })
  return `${authBase}?${search.toString()}`
}

export async function completeGoogleDriveAuth({ code, redirectUri, userId, accessToken }) {
  const tokenPayload = await exchangeGoogleCode(code, redirectUri)
  const about = await fetchGoogleAbout(tokenPayload.access_token)
  const existing = await getGoogleDriveConnection(userId, accessToken)
  return saveGoogleDriveConnection({
    accessToken: tokenPayload.access_token,
    refreshToken: tokenPayload.refresh_token || existing?.refreshToken || '',
    expiresAt: new Date(Date.now() + Number(tokenPayload.expires_in ?? 3600) * 1000).toISOString(),
    scope: tokenPayload.scope || scope,
    email: about?.user?.emailAddress ?? existing?.email ?? null,
    displayName: about?.user?.displayName ?? existing?.displayName ?? null,
  }, userId, accessToken)
}

export async function disconnectGoogleDrive(userId = '', accessToken = '') {
  await deleteGoogleDriveConnection(userId, accessToken)
  return { disconnected: true }
}

export async function listGoogleDriveFiles(userId = '', accessToken = '', search = '') {
  const resolvedAccessToken = await resolveGoogleDriveAccessToken(userId, accessToken)
  const params = new URLSearchParams({
    pageSize: '20',
    fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink)',
    orderBy: 'modifiedTime desc',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    q: buildDriveSearch(search),
  })
  const response = await fetch(`${driveFilesUrl}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${resolvedAccessToken}` },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error?.message ?? `Google Drive listing failed (${response.status})`)
    error.statusCode = response.status
    throw error
  }
  return {
    files: Array.isArray(payload.files) ? payload.files.map(mapDriveFile) : [],
    nextPageToken: payload.nextPageToken ?? null,
  }
}

async function resolveGoogleDriveAccessToken(userId, accessToken) {
  const connection = await getGoogleDriveConnection(userId, accessToken)
  if (!connection?.refreshToken) {
    const error = new Error('Google Drive is not connected')
    error.statusCode = 400
    throw error
  }

  const expiresAt = connection.expiresAt ? Date.parse(connection.expiresAt) : 0
  const freshEnough = connection.accessToken && expiresAt - Date.now() > 60_000
  if (freshEnough) return connection.accessToken

  const refreshed = await refreshGoogleToken(connection.refreshToken)
  const updated = await saveGoogleDriveConnection({
    ...connection,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token || connection.refreshToken,
    expiresAt: new Date(Date.now() + Number(refreshed.expires_in ?? 3600) * 1000).toISOString(),
    scope: refreshed.scope || connection.scope || scope,
  }, userId, accessToken)
  return updated.accessToken
}

async function exchangeGoogleCode(code, redirectUri) {
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error_description ?? payload.error ?? `Google token exchange failed (${response.status})`)
    error.statusCode = response.status
    throw error
  }
  return payload
}

async function refreshGoogleToken(refreshToken) {
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error_description ?? payload.error ?? `Google token refresh failed (${response.status})`)
    error.statusCode = response.status
    throw error
  }
  return payload
}

async function fetchGoogleAbout(accessToken) {
  const response = await fetch(`${driveAboutUrl}?fields=user(displayName,emailAddress)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return response.json().catch(() => null)
}

function mapDriveFile(file) {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: Number(file.size ?? 0),
    modifiedTime: file.modifiedTime ?? null,
    webViewLink: file.webViewLink ?? '',
    iconLink: file.iconLink ?? '',
  }
}

function buildDriveSearch(search) {
  const filters = ["trashed = false"]
  const trimmed = search.trim()
  if (trimmed) {
    const escaped = trimmed.replace(/'/g, "\\'")
    filters.push(`name contains '${escaped}'`)
  }
  return filters.join(' and ')
}

function getGoogleClientId() {
  const value = process.env.GOOGLE_DRIVE_CLIENT_ID || ''
  if (!value) {
    const error = new Error('GOOGLE_DRIVE_CLIENT_ID is not configured')
    error.statusCode = 400
    throw error
  }
  return value
}

function getGoogleClientSecret() {
  const value = process.env.GOOGLE_DRIVE_CLIENT_SECRET || ''
  if (!value) {
    const error = new Error('GOOGLE_DRIVE_CLIENT_SECRET is not configured')
    error.statusCode = 400
    throw error
  }
  return value
}
