import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const runtimeDir = resolve(process.cwd(), '.test-runtime/document-sources')
process.env.FINETUNA_RUNTIME_DIR = '.test-runtime/document-sources'

const { listDocumentSources, saveDocumentSources } = await import('../server/documentSourcesStore.mjs')

test.beforeEach(async () => {
  await mkdir(runtimeDir, { recursive: true })
})

test.after(async () => {
  if (existsSync(runtimeDir)) await rm(runtimeDir, { recursive: true, force: true })
})

test('stores and lists document source metadata without raw file content', async () => {
  const saved = await saveDocumentSources([
    {
      provider: 'google_drive',
      externalId: 'file-123',
      name: 'Contract Playbook.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4096,
      modifiedAt: '2026-05-12T10:00:00.000Z',
      webViewLink: 'https://drive.google.com/file/d/file-123/view',
      metadata: { category: 'contracts' },
    },
  ], 'user-1')

  const listed = await listDocumentSources('user-1')

  assert.equal(saved.length, 1)
  assert.equal(listed.length, 1)
  assert.equal(listed[0].provider, 'google_drive')
  assert.equal(listed[0].externalId, 'file-123')
  assert.equal(listed[0].name, 'Contract Playbook.pdf')
  assert.deepEqual(listed[0].metadata, { category: 'contracts' })
})
