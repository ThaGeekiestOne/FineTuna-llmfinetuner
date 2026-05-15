import { createSession, deleteSession, getSessionUser } from './authStore.mjs'
import { getSupabaseUser, isSupabaseAuthConfigured, refreshSupabaseSession, signOutSupabase } from './authProvider.mjs'

export const sessionCookieName = 'finetuna_session'
export const supabaseAccessCookieName = 'finetuna_sb_access'
export const supabaseRefreshCookieName = 'finetuna_sb_refresh'
export const supabaseRefreshHeaderName = 'x-finetuna-refresh-token'

export async function readAuthenticatedUser(request, response = null) {
  if (isSupabaseAuthConfigured()) {
    return readSupabaseSession(request, response)
  }
  const token = readSessionToken(request)
  if (!token) return null
  const resolved = await getSessionUser(token)
  return resolved ? { ...resolved, provider: 'local' } : null
}

export async function requireAuthenticatedUser(request, response = null) {
  const session = await readAuthenticatedUser(request, response)
  if (!session?.user) {
    const error = new Error('Authentication required')
    error.statusCode = 401
    throw error
  }
  return session.user
}

export async function startAuthenticatedSession(response, sessionInput) {
  if (sessionInput.provider === 'supabase') {
    response.setHeader('Set-Cookie', [
      buildSupabaseCookie(supabaseAccessCookieName, sessionInput.accessToken, 60 * 60),
      buildSupabaseCookie(supabaseRefreshCookieName, sessionInput.refreshToken, 60 * 60 * 24 * 30),
      clearLocalSessionCookie(),
    ])
    return sessionInput
  }
  const session = await createSession(sessionInput.user.id)
  response.setHeader('Set-Cookie', [
    buildSessionCookie(session.token),
    clearSupabaseCookie(supabaseAccessCookieName),
    clearSupabaseCookie(supabaseRefreshCookieName),
  ])
  return session
}

export async function destroyAuthenticatedSession(request, response) {
  if (isSupabaseAuthConfigured()) {
    const accessToken = readCookie(request, supabaseAccessCookieName)
    await signOutSupabase(accessToken)
    response.setHeader('Set-Cookie', [
      clearSupabaseCookie(supabaseAccessCookieName),
      clearSupabaseCookie(supabaseRefreshCookieName),
      clearLocalSessionCookie(),
    ])
    return
  }

  const token = readSessionToken(request)
  if (token) await deleteSession(token)
  response.setHeader('Set-Cookie', clearLocalSessionCookie())
}

export function readSessionToken(request) {
  return readCookie(request, sessionCookieName)
}

export function readSupabaseAccessToken(request) {
  return readCookie(request, supabaseAccessCookieName) || readBearerToken(request)
}

export function readCookie(request, key) {
  const header = request.headers?.cookie
  if (!header) return ''
  const cookies = parseCookies(header)
  return cookies[key] ?? ''
}

function parseCookies(header) {
  return String(header)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((result, part) => {
      const [key, ...rest] = part.split('=')
      result[key] = decodeURIComponent(rest.join('='))
      return result
    }, {})
}

function buildSessionCookie(token) {
  return `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
}

function clearLocalSessionCookie() {
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

function buildSupabaseCookie(name, value, maxAgeSeconds) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`
}

function clearSupabaseCookie(name) {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

async function readSupabaseSession(request, response) {
  const accessCookie = readCookie(request, supabaseAccessCookieName)
  const refreshCookie = readCookie(request, supabaseRefreshCookieName)
  const bearerAccessToken = readBearerToken(request)
  const accessToken = accessCookie || bearerAccessToken
  const refreshToken = refreshCookie || readHeader(request, supabaseRefreshHeaderName)

  if (accessToken) {
    try {
      const user = await getSupabaseUser(accessToken)
      if (user) {
        if (response && (!accessCookie || (!refreshCookie && refreshToken))) {
          response.setHeader('Set-Cookie', [
            buildSupabaseCookie(supabaseAccessCookieName, accessToken, 60 * 60),
            ...(refreshToken ? [buildSupabaseCookie(supabaseRefreshCookieName, refreshToken, 60 * 60 * 24 * 30)] : []),
            clearLocalSessionCookie(),
          ])
        }
        return { user, provider: 'supabase' }
      }
    } catch {}
  }

  if (!refreshToken || !response) return null
  try {
    const refreshed = await refreshSupabaseSession(refreshToken)
    if (!refreshed) return null
    response.setHeader('Set-Cookie', [
      buildSupabaseCookie(supabaseAccessCookieName, refreshed.accessToken, 60 * 60),
      buildSupabaseCookie(supabaseRefreshCookieName, refreshed.refreshToken, 60 * 60 * 24 * 30),
      clearLocalSessionCookie(),
    ])
    return { user: refreshed.user, provider: 'supabase' }
  } catch {
    return null
  }
}

function readHeader(request, key) {
  return request.headers?.[key.toLowerCase()] ?? request.headers?.[key] ?? ''
}

function readBearerToken(request) {
  const authorization = readHeader(request, 'authorization')
  const match = String(authorization).match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() ?? ''
}
