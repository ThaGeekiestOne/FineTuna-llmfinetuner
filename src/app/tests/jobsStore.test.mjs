import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const runtimeDir = resolve(process.cwd(), '.test-runtime/jobs-store')
const jobsFile = resolve(runtimeDir, 'jobs.json')
process.env.FINETUNA_RUNTIME_DIR = '.test-runtime/jobs-store'

const { createJob, deleteJob, listJobs, updateJob } = await import('../server/jobsStore.mjs')

test.beforeEach(async () => {
  await mkdir(runtimeDir, { recursive: true })
  await writeFile(jobsFile, JSON.stringify({ jobs: [] }, null, 2))
})

test.after(async () => {
  if (existsSync(runtimeDir)) await rm(runtimeDir, { recursive: true, force: true })
})

test('stores, updates, and deletes persisted jobs', async () => {
  const created = await createJob({
    userId: 'local-user',
    modelName: 'Mistral 7B Instruct',
    templateName: 'Code',
    technique: 'LoRA',
    hyperparameters: { epochs: 3, learningRate: '2e-4', batchSize: 4, warmupSteps: 100, gradientAccumulation: 4, maxSequenceLength: 2048, weightDecay: 0.01 },
    datasetTotal: 2400,
    script: 'print("train")',
  })

  const updated = await updateJob(created.id, { status: 'completed', progress: 100 })
  const jobs = await listJobs('local-user')

  assert.equal(updated?.status, 'completed')
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].progress, 100)

  const deleted = await deleteJob(created.id)
  assert.equal(deleted, true)
  assert.equal((await listJobs('local-user')).length, 0)
})

test('enforces the 10 version cap without auto deletion', async () => {
  for (let index = 0; index < 10; index += 1) {
    await createJob({
      userId: 'local-user',
      modelName: `Model ${index}`,
      templateName: 'Code',
      technique: 'LoRA',
      hyperparameters: { epochs: 3, learningRate: '2e-4', batchSize: 4, warmupSteps: 100, gradientAccumulation: 4, maxSequenceLength: 2048, weightDecay: 0.01 },
      datasetTotal: 2000,
      script: 'print("train")',
    })
  }

  await assert.rejects(
    createJob({
      userId: 'local-user',
      modelName: 'Model overflow',
      templateName: 'Code',
      technique: 'LoRA',
      hyperparameters: { epochs: 3, learningRate: '2e-4', batchSize: 4, warmupSteps: 100, gradientAccumulation: 4, maxSequenceLength: 2048, weightDecay: 0.01 },
      datasetTotal: 2000,
      script: 'print("train")',
    }),
    /Version limit reached/,
  )

  const payload = JSON.parse(await readFile(jobsFile, 'utf8'))
  assert.equal(payload.jobs.length, 10)
})
