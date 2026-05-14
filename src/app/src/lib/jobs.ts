import type { Hyperparameters } from './training'

export type StoredJob = {
  id: string
  userId: string
  modelName: string
  templateName: string
  technique: string
  createdAt: string
  updatedAt: string
  status: 'queued' | 'running' | 'completed' | 'stopped'
  progress: number
  epoch: number
  step: number
  trainLoss: number
  validationLoss: number
  gpuMemory: string
  eta: string
  hyperparameters: Hyperparameters
  datasetTotal: number
  script: string
  report: string
  downloadArtifacts: Array<{ label: string; size: string; path?: string }>
  kaggleDatasetRef: string
  kaggleKernelRef: string
  kaggleStatusRaw: string
}

export type KaggleOAuthStatus = {
  oauth: {
    configured: boolean
    username: string | null
    scopes: string[]
    authMethod: string
  }
  session: {
    id: string
    status: string
    url: string
    logs: string
    error: string
    createdAt: string
  } | null
}

export async function listStoredJobs(): Promise<StoredJob[]> {
  const response = await fetch('/api/jobs')
  if (!response.ok) throw new Error(`Could not load jobs (${response.status})`)
  const payload = (await response.json()) as { jobs: StoredJob[] }
  return payload.jobs
}

export async function createStoredJob(input: Partial<StoredJob>): Promise<StoredJob> {
  const response = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as { job?: StoredJob; error?: string }
  if (!response.ok || !payload.job) throw new Error(payload.error ?? `Could not create job (${response.status})`)
  return payload.job
}

export async function updateStoredJob(id: string, patch: Partial<StoredJob>): Promise<StoredJob> {
  const response = await fetch(`/api/jobs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const payload = (await response.json().catch(() => ({}))) as { job?: StoredJob; error?: string }
  if (!response.ok || !payload.job) throw new Error(payload.error ?? `Could not update job (${response.status})`)
  return payload.job
}

export async function deleteStoredJob(id: string): Promise<void> {
  const response = await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
  if (!response.ok && response.status !== 204) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error ?? `Could not delete job (${response.status})`)
  }
}

export async function saveKaggleCredentials(input: { username: string; key: string }) {
  const response = await fetch('/api/kaggle/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as { configured?: boolean; username?: string; error?: string }
  if (!response.ok || !payload.configured) throw new Error(payload.error ?? `Could not save Kaggle credentials (${response.status})`)
  return payload
}

export async function getKaggleCredentialsStatus() {
  const response = await fetch('/api/kaggle/credentials')
  const payload = (await response.json().catch(() => ({}))) as { configured?: boolean; username?: string; authMethod?: string | null; error?: string }
  if (!response.ok) throw new Error(payload.error ?? `Could not load Kaggle credential status (${response.status})`)
  return payload
}

export async function startKaggleJob(jobId: string, examples: Array<{ instruction: string; response: string }>) {
  const response = await fetch('/api/kaggle/jobs/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, examples }),
  })
  const payload = (await response.json().catch(() => ({}))) as { job?: StoredJob; error?: string }
  if (!response.ok || !payload.job) throw new Error(payload.error ?? `Could not start Kaggle job (${response.status})`)
  return payload.job
}

export async function fetchKaggleJobStatus(jobId: string) {
  const response = await fetch(`/api/kaggle/jobs/status?jobId=${encodeURIComponent(jobId)}`)
  const payload = (await response.json().catch(() => ({}))) as { job?: StoredJob; error?: string }
  if (!response.ok || !payload.job) throw new Error(payload.error ?? `Could not read Kaggle status (${response.status})`)
  return payload.job
}

export async function downloadKaggleJobOutput(jobId: string) {
  const response = await fetch('/api/kaggle/jobs/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, confirmOutputDownload: true }),
  })
  const payload = (await response.json().catch(() => ({}))) as { job?: StoredJob; error?: string }
  if (!response.ok || !payload.job) throw new Error(payload.error ?? `Could not download Kaggle output (${response.status})`)
  return payload.job
}

export function buildKaggleArtifactUrl(jobId: string, file: string) {
  const params = new URLSearchParams({ jobId, file })
  return `/api/kaggle/jobs/artifact?${params.toString()}`
}

export async function getKaggleOAuthStatus(): Promise<KaggleOAuthStatus> {
  const response = await fetch('/api/kaggle/auth')
  const payload = (await response.json().catch(() => ({}))) as KaggleOAuthStatus & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? `Could not load Kaggle OAuth status (${response.status})`)
  return payload
}

export async function startKaggleOAuthLogin(force = false): Promise<KaggleOAuthStatus> {
  const response = await fetch('/api/kaggle/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'start', force }),
  })
  const payload = (await response.json().catch(() => ({}))) as KaggleOAuthStatus & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? `Could not start Kaggle OAuth login (${response.status})`)
  return payload
}

export async function confirmKaggleOAuthLogin(code: string): Promise<KaggleOAuthStatus> {
  const response = await fetch('/api/kaggle/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'confirm', code }),
  })
  const payload = (await response.json().catch(() => ({}))) as KaggleOAuthStatus & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? `Could not confirm Kaggle OAuth login (${response.status})`)
  return payload
}

export async function revokeKaggleOAuthLogin(): Promise<KaggleOAuthStatus> {
  const response = await fetch('/api/kaggle/auth', { method: 'DELETE' })
  const payload = (await response.json().catch(() => ({}))) as KaggleOAuthStatus & { revoked?: boolean; error?: string }
  if (!response.ok) throw new Error(payload.error ?? `Could not revoke Kaggle OAuth login (${response.status})`)
  return payload
}
