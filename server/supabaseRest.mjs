import { isSupabaseAuthConfigured } from './authProvider.mjs'

export function shouldUseSupabaseData(accessToken = '') {
  return Boolean(isSupabaseAuthConfigured() && accessToken)
}

export async function selectRows({ table, accessToken, filters = {}, orderBy = '', limit = 0 }) {
  const search = new URLSearchParams({ select: '*' })
  for (const [key, value] of Object.entries(filters)) {
    search.set(key, `eq.${value}`)
  }
  if (orderBy) search.set('order', orderBy)
  if (limit > 0) search.set('limit', String(limit))
  return supabaseRestFetch(`/rest/v1/${table}?${search.toString()}`, {
    method: 'GET',
    accessToken,
  })
}

export async function insertRow({ table, accessToken, row }) {
  const rows = await supabaseRestFetch(`/rest/v1/${table}`, {
    method: 'POST',
    accessToken,
    body: row,
    prefer: 'return=representation',
  })
  return Array.isArray(rows) ? rows[0] ?? null : null
}

export async function updateRows({ table, accessToken, filters = {}, patch }) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    search.set(key, `eq.${value}`)
  }
  const rows = await supabaseRestFetch(`/rest/v1/${table}?${search.toString()}`, {
    method: 'PATCH',
    accessToken,
    body: patch,
    prefer: 'return=representation',
  })
  return Array.isArray(rows) ? rows[0] ?? null : null
}

export async function upsertRow({ table, accessToken, row, onConflict }) {
  const rows = await supabaseRestFetch(`/rest/v1/${table}${onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : ''}`, {
    method: 'POST',
    accessToken,
    body: row,
    prefer: 'resolution=merge-duplicates,return=representation',
  })
  return Array.isArray(rows) ? rows[0] ?? null : null
}

export async function deleteRows({ table, accessToken, filters = {} }) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    search.set(key, `eq.${value}`)
  }
  await supabaseRestFetch(`/rest/v1/${table}?${search.toString()}`, {
    method: 'DELETE',
    accessToken,
    prefer: 'return=minimal',
  })
  return true
}

async function supabaseRestFetch(path, { method, accessToken, body, prefer = '' }) {
  const response = await fetch(`${getSupabaseUrl()}${path}`, {
    method,
    headers: {
      apikey: getSupabaseAnonKey(),
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (response.status === 204) return null
  const payload = await response.json().catch(() => [])
  if (!response.ok) {
    const error = new Error(payload.message ?? payload.error ?? `Supabase data request failed (${response.status})`)
    error.statusCode = response.status
    throw error
  }
  return payload
}

function getSupabaseUrl() {
  return process.env.VITE_SUPABASE_URL || ''
}

function getSupabaseAnonKey() {
  return process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
}
