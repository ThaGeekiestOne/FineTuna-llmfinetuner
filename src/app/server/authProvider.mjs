import { authenticateUser, createUser } from './authStore.mjs'

export function isSupabaseAuthConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey())
}

export async function signUpUser(input) {
  if (!isSupabaseAuthConfigured()) {
    const user = await createUser(input)
    return { provider: 'local', user }
  }

  const payload = await supabaseFetch('/auth/v1/signup', {
    method: 'POST',
    body: {
      email: String(input.email ?? '').trim(),
      password: String(input.password ?? ''),
      data: { name: String(input.name ?? '').trim() },
    },
  })

  const resolvedUser = resolveSupabaseUser(payload)
  if (!resolvedUser) {
    const error = new Error(payload.msg ?? payload.error_description ?? payload.error ?? 'Supabase signup did not return a user')
    error.statusCode = 502
    throw error
  }

  return {
    provider: 'supabase',
    user: mapSupabaseUser(resolvedUser),
    accessToken: payload.session?.access_token ?? '',
    refreshToken: payload.session?.refresh_token ?? '',
    emailConfirmationRequired: !payload.session?.access_token,
  }
}

export async function signInUser(input) {
  if (!isSupabaseAuthConfigured()) {
    const user = await authenticateUser(input)
    return { provider: 'local', user }
  }

  const payload = await supabaseFetch('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: {
      email: String(input.email ?? '').trim(),
      password: String(input.password ?? ''),
    },
  })

  if (!payload.user || !payload.access_token) {
    const error = new Error('Supabase login did not return a valid session')
    error.statusCode = 502
    throw error
  }

  return {
    provider: 'supabase',
    user: mapSupabaseUser(payload.user),
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? '',
  }
}

export async function getSupabaseUser(accessToken) {
  if (!isSupabaseAuthConfigured() || !accessToken) return null
  const payload = await supabaseFetch('/auth/v1/user', {
    method: 'GET',
    bearer: accessToken,
  })
  return mapSupabaseUser(payload)
}

export async function refreshSupabaseSession(refreshToken) {
  if (!isSupabaseAuthConfigured() || !refreshToken) return null
  const payload = await supabaseFetch('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  })
  if (!payload.user || !payload.access_token) return null
  return {
    user: mapSupabaseUser(payload.user),
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? '',
  }
}

export async function signOutSupabase(accessToken) {
  if (!isSupabaseAuthConfigured() || !accessToken) return
  await supabaseFetch('/auth/v1/logout', {
    method: 'POST',
    bearer: accessToken,
    allowFailure: true,
  })
}

function mapSupabaseUser(user) {
  return {
    id: user.id,
    name: user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'User',
    email: user.email ?? '',
    createdAt: user.created_at ?? new Date().toISOString(),
  }
}

function resolveSupabaseUser(payload) {
  if (payload?.user) return payload.user
  if (payload?.id && payload?.email) return payload
  return null
}

async function supabaseFetch(path, { method, body, bearer, allowFailure = false }) {
  const supabaseUrl = getSupabaseUrl()
  const supabaseAnonKey = getSupabaseAnonKey()
  const url = `${supabaseUrl}${path}`
  const response = await fetch(url, {
    method,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: bearer ? `Bearer ${bearer}` : `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok && !allowFailure) {
    const error = new Error(payload.msg ?? payload.error_description ?? payload.error ?? `Supabase auth request failed (${response.status})`)
    error.statusCode = response.status
    throw error
  }
  return payload
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
}

function getSupabaseAnonKey() {
  return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
}
