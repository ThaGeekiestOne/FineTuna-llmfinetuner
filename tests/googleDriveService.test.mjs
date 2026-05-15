import test from 'node:test'
import assert from 'node:assert/strict'
import { createGoogleDriveAuthState } from '../server/googleDriveService.mjs'

test('Google Drive OAuth state is generated from Web Crypto', () => {
  const state = createGoogleDriveAuthState()
  assert.match(state, /^[a-f0-9]{64}$/)
  assert.notEqual(state, createGoogleDriveAuthState())
})
