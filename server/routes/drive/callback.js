import { readCookie, readSupabaseAccessToken, requireAuthenticatedUser } from '../../authSession.mjs'
import { completeGoogleDriveAuth } from '../../googleDriveService.mjs'

const driveStateCookieName = 'finetuna_drive_state'

export default async function handler(request, response) {
  try {
    if (request.method !== 'GET') {
      response.statusCode = 405
      response.end('Method not allowed')
      return
    }

    const user = await requireAuthenticatedUser(request, response)
    const url = new URL(request.url ?? 'http://localhost/api/drive/callback', 'http://localhost')
    const code = url.searchParams.get('code') ?? ''
    const state = url.searchParams.get('state') ?? ''
    const storedState = readCookie(request, driveStateCookieName)
    const accessToken = readSupabaseAccessToken(request)

    if (!code || !state || !storedState || state !== storedState) {
      response.statusCode = 400
      appendSetCookie(response, clearDriveStateCookie())
      response.setHeader('Content-Type', 'text/html; charset=utf-8')
      response.end(renderCallbackPage('Google Drive connection failed. The OAuth state did not validate.'))
      return
    }

    await completeGoogleDriveAuth({
      code,
      redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI || `${getBaseUrl(request)}/api/drive/callback`,
      userId: user.id,
      accessToken,
    })

    response.statusCode = 200
    appendSetCookie(response, clearDriveStateCookie())
    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    response.end(renderCallbackPage('Google Drive connected. You can close this tab now.', true))
  } catch (error) {
    response.statusCode = error.statusCode ?? 500
    appendSetCookie(response, clearDriveStateCookie())
    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    response.end(renderCallbackPage(error instanceof Error ? error.message : 'Google Drive connection failed'))
  }
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

function renderCallbackPage(message, success = false) {
  const payload = success ? "window.opener?.postMessage({ type: 'finetuna-google-drive-connected' }, window.location.origin);" : ''
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>FineTuna Google Drive</title>
  </head>
  <body>
    <p>${escapeHtml(message)}</p>
    <script>
      ${payload}
      setTimeout(() => window.close(), 300);
    </script>
  </body>
</html>`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
