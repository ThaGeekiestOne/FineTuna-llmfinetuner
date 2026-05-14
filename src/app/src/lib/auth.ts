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

export async function signOut(): Promise<void> {
  const response = await fetch('/api/auth/session', { method: 'DELETE' })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(payload.error ?? `Could not sign out (${response.status})`)
}
