import test from 'node:test'
import assert from 'node:assert/strict'
import { applyCompletedKaggleOutput, buildKaggleTrainScript, parseKernelStatus } from '../server/kaggleService.mjs'

test('maps queued Kaggle status into an early-progress job state', () => {
  const mapped = parseKernelStatus('queued', {
    progress: 0,
    hyperparameters: { epochs: 3 },
    datasetTotal: 1200,
  })

  assert.equal(mapped.status, 'queued')
  assert.equal(mapped.progress, 0)
  assert.equal(mapped.eta, 'Queued on Kaggle')
})

test('maps running Kaggle status into mid-run metrics', () => {
  const mapped = parseKernelStatus('running', {
    progress: 12,
    epoch: 0,
    step: 0,
    trainLoss: 2.4,
    validationLoss: 2.7,
    hyperparameters: { epochs: 4 },
    datasetTotal: 2000,
  })

  assert.equal(mapped.status, 'running')
  assert.equal(mapped.progress, 12)
  assert.equal(mapped.epoch, 0)
  assert.equal(mapped.step, 0)
  assert.equal(mapped.trainLoss, 2.4)
  assert.equal(mapped.gpuMemory, 'Kaggle GPU attached')
})

test('maps completed Kaggle status into a finished job state', () => {
  const mapped = parseKernelStatus('complete', {
    progress: 65,
    step: 600,
    trainLoss: 1.4,
    validationLoss: 1.8,
    gpuMemory: '14 / 16 GB',
    hyperparameters: { epochs: 5 },
    datasetTotal: 1800,
  })

  assert.equal(mapped.status, 'completed')
  assert.equal(mapped.progress, 100)
  assert.equal(mapped.epoch, 0)
  assert.equal(mapped.step, 600)
  assert.equal(mapped.trainLoss, 1.4)
  assert.match(mapped.eta, /Click Download Kaggle output/)
})

test('hydrates a completed Kaggle job with training summary and artifacts', () => {
  const hydrated = applyCompletedKaggleOutput(
    {
      report: 'old',
      downloadArtifacts: [{ label: 'Adapter files', size: '74 MB' }],
      epoch: 1,
      step: 50,
      trainLoss: 2.1,
      validationLoss: 2.4,
    },
    {
      status: 'completed',
      epoch: 1,
      step: 100,
      trainLoss: 1.8,
      validationLoss: 2,
      eta: 'Complete',
    },
    {
      report: 'new report',
      summary: {
        status: 'completed',
        epoch: 3,
        step: 400,
        trainLoss: 0.42,
        validationLoss: 0.61,
        artifacts: [
          { label: 'Adapter', path: '/kaggle/working/finetuna_output/adapter' },
          { label: 'Merged model', path: '/kaggle/working/finetuna_output/merged' },
        ],
      },
      downloadArtifacts: [
        { label: 'training_summary.json', size: 'Kaggle output' },
        { label: '__results__.html', size: 'Kaggle output' },
      ],
    },
  )

  assert.equal(hydrated.epoch, 3)
  assert.equal(hydrated.step, 400)
  assert.equal(hydrated.trainLoss, 0.42)
  assert.equal(hydrated.validationLoss, 0.61)
  assert.equal(hydrated.report, 'new report')
  assert.deepEqual(hydrated.downloadArtifacts, [
    { label: 'Adapter: adapter', size: 'Trained artifact' },
    { label: 'Merged model: merged', size: 'Trained artifact' },
    { label: 'training_summary.json', size: 'Kaggle output' },
    { label: '__results__.html', size: 'Kaggle output' },
  ])
})

test('generated Kaggle trainer requires the requested GPU instead of falling back to CPU', () => {
  const script = buildKaggleTrainScript({
    id: 'job-1',
    modelName: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
    templateName: 'Code',
    technique: 'QLoRA',
    hyperparameters: {
      computeTarget: 'gpu',
      accelerator: 'NvidiaTeslaT4',
      continueTraining: false,
      precision: 'bf16',
      learningRate: '1e-4',
      batchSize: 2,
      gradientAccumulation: 4,
      warmupSteps: 20,
      maxSequenceLength: 512,
      weightDecay: 0.01,
      saveSteps: 25,
      evalSteps: 25,
      optimizer: 'paged_adamw_8bit',
      lrScheduler: 'cosine',
      gradientCheckpointing: true,
      loraRank: 16,
      loraAlpha: 32,
      loraDropout: 0.05,
    },
  })

  assert.match(script, /requested_accelerator = hyperparameters\.get\('accelerator', 'None'\)/)
  assert.match(script, /Kaggle did not attach the requested GPU accelerator/)
  assert.match(script, /load_kwargs\['torch_dtype'\] = torch_dtype/)
  assert.doesNotMatch(script, /CUDA_VISIBLE_DEVICES/)
  assert.doesNotMatch(script, /falling back to CPU/)
})
