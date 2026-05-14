import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { getRuntimeDir, resolveRuntimePath } from './runtimePaths.mjs'
import { deleteRows, insertRow, selectRows, shouldUseSupabaseData, updateRows } from './supabaseRest.mjs'

const maxVersionsPerUser = 10

export async function listJobs(userId = 'local-user', accessToken = '') {
  if (shouldUseSupabaseData(accessToken)) {
    const rows = await selectRows({
      table: 'training_jobs',
      accessToken,
      filters: { user_id: userId },
      orderBy: 'created_at.desc',
    })
    return sortJobs(rows.map(mapRemoteJobToLocal))
  }
  const state = await readState()
  return sortJobs(state.jobs.filter((job) => job.userId === userId))
}

export async function getJob(id, accessToken = '') {
  if (shouldUseSupabaseData(accessToken)) {
    const rows = await selectRows({
      table: 'training_jobs',
      accessToken,
      filters: { id },
      limit: 1,
    })
    return rows[0] ? mapRemoteJobToLocal(rows[0]) : null
  }
  const state = await readState()
  return state.jobs.find((job) => job.id === id) ?? null
}

export async function createJob(input, accessToken = '') {
  if (shouldUseSupabaseData(accessToken)) {
    const existingJobs = await listJobs(input.userId ?? 'local-user', accessToken)
    if (existingJobs.length >= maxVersionsPerUser) {
      const error = new Error(`Version limit reached. Delete an older run before creating a new one.`)
      error.statusCode = 409
      throw error
    }
    const now = new Date().toISOString()
    const row = mapLocalJobToRemote({
      id: input.id ?? `job-${Date.now().toString(36)}`,
      userId: input.userId ?? 'local-user',
      modelName: input.modelName,
      templateName: input.templateName,
      technique: input.technique,
      createdAt: now,
      updatedAt: now,
      status: input.status ?? 'queued',
      progress: input.progress ?? 0,
      epoch: input.epoch ?? 0,
      step: input.step ?? 0,
      trainLoss: input.trainLoss ?? 2.4,
      validationLoss: input.validationLoss ?? 2.7,
      gpuMemory: input.gpuMemory ?? '0 / 16 GB',
      eta: input.eta ?? 'Waiting for Kaggle GPU',
      hyperparameters: input.hyperparameters,
      datasetTotal: input.datasetTotal,
      script: input.script,
      report: input.report ?? '',
      downloadArtifacts: input.downloadArtifacts ?? defaultArtifacts(),
      kaggleDatasetRef: input.kaggleDatasetRef ?? '',
      kaggleKernelRef: input.kaggleKernelRef ?? '',
      kaggleStatusRaw: input.kaggleStatusRaw ?? '',
    })
    const inserted = await insertRow({
      table: 'training_jobs',
      accessToken,
      row,
    })
    return mapRemoteJobToLocal(inserted)
  }
  const state = await readState()
  const userJobs = state.jobs.filter((job) => job.userId === input.userId)
  if (userJobs.length >= maxVersionsPerUser) {
    const error = new Error(`Version limit reached. Delete an older run before creating a new one.`)
    error.statusCode = 409
    throw error
  }

  const now = new Date().toISOString()
  const job = {
    id: input.id ?? `job-${Date.now().toString(36)}`,
    userId: input.userId ?? 'local-user',
    modelName: input.modelName,
    templateName: input.templateName,
    technique: input.technique,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'queued',
    progress: input.progress ?? 0,
    epoch: input.epoch ?? 0,
    step: input.step ?? 0,
    trainLoss: input.trainLoss ?? 2.4,
    validationLoss: input.validationLoss ?? 2.7,
    gpuMemory: input.gpuMemory ?? '0 / 16 GB',
    eta: input.eta ?? 'Waiting for Kaggle GPU',
    hyperparameters: input.hyperparameters,
    datasetTotal: input.datasetTotal,
    script: input.script,
    report: input.report ?? '',
    downloadArtifacts: input.downloadArtifacts ?? defaultArtifacts(),
    kaggleDatasetRef: input.kaggleDatasetRef ?? '',
    kaggleKernelRef: input.kaggleKernelRef ?? '',
    kaggleStatusRaw: input.kaggleStatusRaw ?? '',
  }

  state.jobs.push(job)
  await writeState(state)
  return job
}

export async function updateJob(id, patch, accessToken = '') {
  if (shouldUseSupabaseData(accessToken)) {
    const current = await getJob(id, accessToken)
    if (!current) return null
    const updated = {
      ...current,
      ...patch,
      id: current.id,
      userId: current.userId,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    }
    const row = await updateRows({
      table: 'training_jobs',
      accessToken,
      filters: { id },
      patch: mapLocalJobToRemote(updated),
    })
    return row ? mapRemoteJobToLocal(row) : null
  }
  const state = await readState()
  const index = state.jobs.findIndex((job) => job.id === id)
  if (index === -1) return null

  const current = state.jobs[index]
  const updated = {
    ...current,
    ...patch,
    id: current.id,
    userId: current.userId,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  }

  state.jobs[index] = updated
  await writeState(state)
  return updated
}

export async function deleteJob(id, accessToken = '') {
  if (shouldUseSupabaseData(accessToken)) {
    const current = await getJob(id, accessToken)
    if (!current) return false
    await deleteRows({
      table: 'training_jobs',
      accessToken,
      filters: { id },
    })
    return true
  }
  const state = await readState()
  const nextJobs = state.jobs.filter((job) => job.id !== id)
  if (nextJobs.length === state.jobs.length) return false
  state.jobs = nextJobs
  await writeState(state)
  return true
}

export function defaultArtifacts() {
  return [
    { label: 'Adapter files', size: 'Available after download' },
    { label: 'Merged model', size: 'Available after download' },
    { label: 'Training report', size: 'Available after download' },
  ]
}

async function readState() {
  await ensureRuntime()
  const jobsFile = resolveRuntimePath('jobs.json')
  if (!existsSync(jobsFile)) return { jobs: [] }
  const raw = await readFile(jobsFile, 'utf8')
  if (!raw.trim()) return { jobs: [] }
  const parsed = JSON.parse(raw)
  return { jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [] }
}

async function writeState(state) {
  await ensureRuntime()
  const jobsFile = resolveRuntimePath('jobs.json')
  await writeFile(jobsFile, JSON.stringify({ jobs: sortJobs(state.jobs) }, null, 2))
}

async function ensureRuntime() {
  await mkdir(getRuntimeDir(), { recursive: true })
}

function sortJobs(jobs) {
  return [...jobs].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

function mapRemoteJobToLocal(row) {
  return {
    id: row.id,
    userId: row.user_id,
    modelName: row.model_name,
    templateName: row.template_name,
    technique: row.technique,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    progress: row.progress,
    epoch: row.epoch,
    step: row.step,
    trainLoss: row.train_loss,
    validationLoss: row.validation_loss,
    gpuMemory: row.gpu_memory,
    eta: row.eta,
    hyperparameters: row.hyperparameters,
    datasetTotal: row.dataset_total,
    script: row.script,
    report: row.report,
    downloadArtifacts: Array.isArray(row.download_artifacts) ? row.download_artifacts : defaultArtifacts(),
    kaggleDatasetRef: row.kaggle_dataset_ref ?? '',
    kaggleKernelRef: row.kaggle_kernel_ref ?? '',
    kaggleStatusRaw: row.kaggle_status_raw ?? '',
  }
}

function mapLocalJobToRemote(job) {
  return {
    id: job.id,
    user_id: job.userId,
    model_name: job.modelName,
    template_name: job.templateName,
    technique: job.technique,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
    status: job.status,
    progress: job.progress,
    epoch: job.epoch,
    step: job.step,
    train_loss: job.trainLoss,
    validation_loss: job.validationLoss,
    gpu_memory: job.gpuMemory,
    eta: job.eta,
    hyperparameters: job.hyperparameters,
    dataset_total: job.datasetTotal,
    script: job.script,
    report: job.report,
    download_artifacts: job.downloadArtifacts,
    kaggle_dataset_ref: job.kaggleDatasetRef,
    kaggle_kernel_ref: job.kaggleKernelRef,
    kaggle_status_raw: job.kaggleStatusRaw,
  }
}
