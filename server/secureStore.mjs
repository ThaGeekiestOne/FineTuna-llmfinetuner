import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { resolveRuntimePath } from './runtimePaths.mjs'

function getSecureRuntimeDir() {
  return resolveRuntimePath('secure')
}

function getSecretFile() {
  return resolve(getSecureRuntimeDir(), 'secret.key')
}

export async function saveEncryptedJson(path, payload) {
  const envelope = await encryptJsonPayload(payload)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(envelope, null, 2))
}

export async function loadEncryptedJson(path) {
  if (!existsSync(path)) return null
  const raw = JSON.parse(await readFile(path, 'utf8'))
  return decryptJsonPayload(raw)
}

async function readOrCreateSecret() {
  if (process.env.FINETUNA_ENCRYPTION_KEY) {
    return Buffer.from(process.env.FINETUNA_ENCRYPTION_KEY, 'base64')
  }
  const runtimeDir = getSecureRuntimeDir()
  const secretFile = getSecretFile()
  await mkdir(runtimeDir, { recursive: true })
  if (existsSync(secretFile)) {
    return Buffer.from(await readFile(secretFile, 'utf8'), 'base64')
  }
  const secret = randomBytes(32)
  await writeFile(secretFile, secret.toString('base64'))
  return secret
}

export async function encryptJsonPayload(payload) {
  const secret = await readOrCreateSecret()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', secret, iv)
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: ciphertext.toString('base64'),
  }
}

export async function decryptJsonPayload(envelope) {
  const secret = await readOrCreateSecret()
  const decipher = createDecipheriv('aes-256-gcm', secret, Buffer.from(envelope.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.data, 'base64')),
    decipher.final(),
  ])
  return JSON.parse(plaintext.toString('utf8'))
}
