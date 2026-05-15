import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGoogleDriveAuthUrl } from '../server/googleDriveService.mjs'

test('Google Drive OAuth URL uses client-provided state and redirect URI', () => {
  const originalClientId = process.env.GOOGLE_DRIVE_CLIENT_ID
  process.env.GOOGLE_DRIVE_CLIENT_ID = 'drive-client-id'

  try {
    const url = new URL(buildGoogleDriveAuthUrl('state-123', 'https://finetuna.netlify.app/drive/callback'))
    assert.equal(url.searchParams.get('client_id'), 'drive-client-id')
    assert.equal(url.searchParams.get('state'), 'state-123')
    assert.equal(url.searchParams.get('redirect_uri'), 'https://finetuna.netlify.app/drive/callback')
  } finally {
    if (originalClientId === undefined) delete process.env.GOOGLE_DRIVE_CLIENT_ID
    else process.env.GOOGLE_DRIVE_CLIENT_ID = originalClientId
  }
})
