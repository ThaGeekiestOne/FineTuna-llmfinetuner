import test from 'node:test'
import assert from 'node:assert/strict'
import { mapHuggingFaceModel } from '../server/providerCatalog.mjs'

test('maps Hugging Face model metadata into model cards', () => {
  const model = mapHuggingFaceModel({
    id: 'mistralai/Mistral-7B-Instruct-v0.3',
    downloads: 1_250_000,
    likes: 5000,
    pipeline_tag: 'text-generation',
    tags: ['license:apache-2.0', 'transformers', '7b'],
  })

  assert.equal(model.id, 'hf:mistralai/Mistral-7B-Instruct-v0.3')
  assert.equal(model.architecture, 'Mistral')
  assert.equal(model.parameters, '7B')
  assert.equal(model.vram, '16 GB')
  assert.equal(model.license, 'apache-2.0')
  assert.equal(model.downloads, '1.3M')
})
