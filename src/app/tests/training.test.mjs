import test from 'node:test'
import assert from 'node:assert/strict'
import {
  advanceJob,
  calculateHyperparameters,
  createJob,
  mergeDatasets,
  parseDatasetText,
  validateDataset,
} from '../src/lib/training.ts'
import { templates } from '../src/lib/catalog.ts'

test('calculates Kaggle-aware defaults by technique', () => {
  assert.equal(calculateHyperparameters('LoRA').learningRate, '2e-4')
  assert.equal(calculateHyperparameters('QLoRA').batchSize, 8)
  assert.equal(calculateHyperparameters('Full').gradientAccumulation, 16)
})

test('parses and validates CSV instruction-response data', () => {
  const examples = parseDatasetText('instruction,response\n"Do x","Return y"\n"Do x","Return y"')
  const result = validateDataset(examples)

  assert.equal(result.total, 2)
  assert.equal(result.valid, true)
  assert.match(result.warnings.join(' '), /duplicate/)
})

test('merges template data with a bounded custom slice', () => {
  const merged = mergeDatasets(templates[0], [
    { instruction: 'custom one', response: 'answer one' },
    { instruction: 'custom two', response: 'answer two' },
  ])

  assert.equal(merged.length, 3)
})

test('advances training job until completion without exceeding 100 percent', () => {
  let job = createJob()
  for (let index = 0; index < 20; index += 1) job = advanceJob(job, 3)

  assert.equal(job.status, 'completed')
  assert.equal(job.progress, 100)
  assert.ok(job.trainLoss < 2.4)
})
