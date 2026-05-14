import { readCookie, requireAuthenticatedUser, supabaseAccessCookieName } from '../../server/authSession.mjs'
import { buildGoogleDriveAuthUrl, createGoogleDriveAuthState, disconnectGoogleDrive, getGoogleDriveStatus } from '../../server/googleDriveService.mjs'

const driveStateCookieName = 'finetuna_drive_state'

export default async function handler(request, response) {
  try {
    const user = await requireAuthenticatedUser(request, response)
    const accessToken = readCookie(request, supabaseAccessCookieName)

    if (request.method === 'GET') {
      return send(response, 200, await getGoogleDriveStatus(user.id, accessToken))
    }

    if (request.method === 'POST') {
      const state = createGoogleDriveAuthState(user.id)
      response.setHeader('Set-Cookie', buildDriveStateCookie(state))
      return send(response, 200, {
        ...await getGoogleDriveStatus(user.id, accessToken),
        url: buildGoogleDriveAuthUrl(state, getGoogleRedirectUri(request)),
      })
    }

    if (request.method === 'DELETE') {
      await disconnectGoogleDrive(user.id, accessToken)
      response.setHeader('Set-Cookie', clearDriveStateCookie())
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

function buildDriveStateCookie(state) {
  return `${driveStateCookieName}=${encodeURIComponent(state)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 10}`
}

function clearDriveStateCookie() {
  return `${driveStateCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

function send(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(payload))
}
