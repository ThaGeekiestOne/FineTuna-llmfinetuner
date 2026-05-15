export type AuthUser = {
  id: string
  name: string
  email: string
  createdAt: string
}

export type SignUpResult = {
  user: AuthUser
  confirmationRequired: boolean
}

export type OAuthProvider = 'google' | 'github'

type OAuthRedirectPayload =
  | { accessToken: string; refreshToken: string }
  | { error: string }

export async function getAuthSession(): Promise<AuthUser | null> {
  const response = await fetch('/api/auth/session')
  const payload = (await response.json().catch(() => ({}))) as { authenticated?: boolean; user?: AuthUser | null; error?: string }
  if (!response.ok) throw new Error(payload.error ?? `Could not load session (${response.status})`)
  return payload.authenticated ? payload.user ?? null : null
}

export async function signIn(input: { email: string; password: string }): Promise<AuthUser> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as { user?: AuthUser; error?: string }
  if (!response.ok || !payload.user) throw new Error(payload.error ?? `Could not sign in (${response.status})`)
  return payload.user
}

export async function signUp(input: { name: string; email: string; password: string }): Promise<SignUpResult> {
  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as { user?: AuthUser; confirmationRequired?: boolean; error?: string }
  if (!response.ok || !payload.user) throw new Error(payload.error ?? `Could not sign up (${response.status})`)
  return { user: payload.user, confirmationRequired: Boolean(payload.confirmationRequired) }
}

export function startOAuthSignIn(provider: OAuthProvider) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) throw new Error('Supabase URL is not configured for OAuth sign-in')

  const url = new URL('/auth/v1/authorize', supabaseUrl)
  url.searchParams.set('provider', provider)
  url.searchParams.set('redirect_to', window.location.origin)
  window.location.assign(url.toString())
}

export function readOAuthRedirectPayload(): OAuthRedirectPayload | null {
  if (!window.location.hash.includes('access_token') && !window.location.hash.includes('error')) return null
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const error = params.get('error_description') || params.get('error')
  if (error) return { error }
  const accessToken = params.get('access_token') ?? ''
  const refreshToken = params.get('refresh_token') ?? ''
  return accessToken ? { accessToken, refreshToken } : null
}

export async function completeOAuthSignIn(input: { accessToken: string; refreshToken: string }): Promise<AuthUser> {
  const response = await fetch('/api/auth/oauth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as { user?: AuthUser; error?: string }
  if (!response.ok || !payload.user) throw new Error(payload.error ?? `Could not complete OAuth sign-in (${response.status})`)
  return payload.user
}

export async function signOut(): Promise<void> {
  const response = await fetch('/api/auth/session', { method: 'DELETE' })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(payload.error ?? `Could not sign out (${response.status})`)
}
