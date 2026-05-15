const supabaseSessionKey = 'finetuna_supabase_session'

type StoredSupabaseSession = {
  accessToken: string
  refreshToken: string
}

export function saveSupabaseSession(input: StoredSupabaseSession) {
  if (!input.accessToken) return
  window.localStorage.setItem(supabaseSessionKey, JSON.stringify(input))
}

export function clearSupabaseSession() {
  window.localStorage.removeItem(supabaseSessionKey)
}

export function getStoredSupabaseSession(): StoredSupabaseSession | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(supabaseSessionKey) || 'null') as Partial<StoredSupabaseSession> | null
    if (!parsed?.accessToken) return null
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken ?? '',
    }
  } catch {
    clearSupabaseSession()
    return null
  }
}

export function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  const session = getStoredSupabaseSession()
  if (session?.accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${session.accessToken}`)
  }
  if (session?.refreshToken && !headers.has('X-Finetuna-Refresh-Token')) {
    headers.set('X-Finetuna-Refresh-Token', session.refreshToken)
  }
  return fetch(input, { ...init, headers })
}
