import { readSupabaseAccessToken, requireAuthenticatedUser } from '../../authSession.mjs'
import { buildGoogleDriveAuthUrl, disconnectGoogleDrive, getGoogleDriveStatus } from '../../googleDriveService.mjs'

const driveStateCookieName = 'finetuna_drive_state'

export default async function handler(request, response) {
  try {
    const user = await requireAuthenticatedUser(request, response)
    const accessToken = readSupabaseAccessToken(request)

    if (request.method === 'GET') {
      return send(response, 200, await getGoogleDriveStatus(user.id, accessToken))
    }

    if (request.method === 'POST') {
      const body = await readJson(request)
      const state = validateOAuthState(body.state)
      const redirectUri = validateRedirectUri(body.redirectUri) || getGoogleRedirectUri(request)
      return send(response, 200, {
        configured: false,
        email: null,
        displayName: null,
        provider: 'google_drive',
        url: buildGoogleDriveAuthUrl(state, redirectUri),
      })
    }

    if (request.method === 'DELETE') {
      await disconnectGoogleDrive(user.id, accessToken)
      appendSetCookie(response, clearDriveStateCookie())
      return send(response, 200, { configured: false, email: null, displayName: null, provider: 'google_drive' })
    }

    return send(response, 405, { error: 'Method not allowed' })
  } catch (error) {
    return send(response, error.statusCode ?? 500, { error: error instanceof Error ? error.message : 'Google Drive auth failed' })
  }
}

function getGoogleRedirectUri(request) {
  return process.env.GOOGLE_DRIVE_REDIRECT_URI || `${getBaseUrl(request)}/api/drive/callback`
}

function getBaseUrl(request) {
  const protocol = request.headers['x-forwarded-proto'] || 'http'
  const host = request.headers['x-forwarded-host'] || request.headers.host || '127.0.0.1:5207'
  return `${protocol}://${host}`
}

function clearDriveStateCookie() {
  return `${driveStateCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

function appendSetCookie(response, cookie) {
  const current = response.getHeader?.('Set-Cookie') ?? response.getHeader?.('set-cookie')
  const next = Array.isArray(current) ? [...current, cookie] : current ? [String(current), cookie] : cookie
  response.setHeader('Set-Cookie', next)
}

function send(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(payload))
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

function validateOAuthState(state) {
  if (typeof state === 'string' && /^[a-f0-9]{64}$/i.test(state)) return state
  const error = new Error('Invalid Google Drive OAuth state')
  error.statusCode = 400
  throw error
}

function validateRedirectUri(redirectUri) {
  if (!redirectUri) return ''
  try {
    const url = new URL(String(redirectUri))
    if (url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return url.toString()
    }
  } catch {}
  const error = new Error('Invalid Google Drive redirect URI')
  error.statusCode = 400
  throw error
}
