import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
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
  const secret = randomBytesBuffer(32)
  await writeFile(secretFile, secret.toString('base64'))
  return secret
}

export async function encryptJsonPayload(payload) {
  const secret = await readOrCreateSecret()
  const iv = randomBytesBuffer(12)
  const key = await importAesKey(secret, ['encrypt'])
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
  const encrypted = Buffer.from(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext))
  const ciphertext = encrypted.subarray(0, -16)
  const tag = encrypted.subarray(-16)
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: ciphertext.toString('base64'),
  }
}

export async function decryptJsonPayload(envelope) {
  const secret = await readOrCreateSecret()
  const key = await importAesKey(secret, ['decrypt'])
  const ciphertext = Buffer.concat([
    Buffer.from(envelope.data, 'base64'),
    Buffer.from(envelope.tag, 'base64'),
  ])
  const plaintext = Buffer.from(await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: Buffer.from(envelope.iv, 'base64') },
    key,
    ciphertext,
  ))
  return JSON.parse(plaintext.toString('utf8'))
}

function randomBytesBuffer(byteLength) {
  const values = new Uint8Array(byteLength)
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random source is not available')
  }
  globalThis.crypto.getRandomValues(values)
  return Buffer.from(values)
}

function importAesKey(secret, usages) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto AES-GCM is not available')
  }
  if (secret.length !== 32) {
    throw new Error('FINETUNA_ENCRYPTION_KEY must decode to 32 bytes')
  }
  return globalThis.crypto.subtle.importKey('raw', secret, { name: 'AES-GCM' }, false, usages)
}
