import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { getRuntimeDir, resolveRuntimePath } from './runtimePaths.mjs'

const usersFile = () => resolveRuntimePath('users.json')
const sessionsFile = () => resolveRuntimePath('sessions.json')
const sessionTtlMs = 1000 * 60 * 60 * 24 * 30
const passwordIterations = 210_000

export async function createUser({ name, email, password }) {
  validateAuthInput({ name, email, password, mode: 'signup' })
  const state = await readUsers()
  const normalizedEmail = normalizeEmail(email)
  if (state.users.some((user) => user.email === normalizedEmail)) {
    const error = new Error('An account with this email already exists')
    error.statusCode = 409
    throw error
  }

  const now = new Date().toISOString()
  const passwordHash = await hashPassword(password)
  const user = {
    id: `user-${randomHex(8)}`,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  }

  state.users.push(user)
  await writeUsers(state)
  return toPublicUser(user)
}

export async function authenticateUser({ email, password }) {
  validateAuthInput({ email, password, mode: 'signin' })
  const state = await readUsers()
  const normalizedEmail = normalizeEmail(email)
  const user = state.users.find((entry) => entry.email === normalizedEmail)
  if (!user || !await verifyPassword(password, user.passwordHash)) {
    const error = new Error('Invalid email or password')
    error.statusCode = 401
    throw error
  }
  return toPublicUser(user)
}

export async function getUserById(id) {
  const state = await readUsers()
  const user = state.users.find((entry) => entry.id === id)
  return user ? toPublicUser(user) : null
}

export async function createSession(userId) {
  const state = await readSessions()
  const now = Date.now()
  const token = randomHex(32)
  state.sessions = state.sessions.filter((session) => Date.parse(session.expiresAt) > now && session.userId !== userId)
  state.sessions.push({
    token,
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + sessionTtlMs).toISOString(),
  })
  await writeSessions(state)
  return {
    token,
    expiresAt: new Date(now + sessionTtlMs).toISOString(),
  }
}

export async function getSessionUser(token) {
  if (!token) return null
  const state = await readSessions()
  const now = Date.now()
  const session = state.sessions.find((entry) => entry.token === token && Date.parse(entry.expiresAt) > now)
  if (!session) return null
  const user = await getUserById(session.userId)
  if (!user) return null
  return {
    session: {
      expiresAt: session.expiresAt,
    },
    user,
  }
}

export async function deleteSession(token) {
  if (!token) return false
  const state = await readSessions()
  const nextSessions = state.sessions.filter((entry) => entry.token !== token)
  if (nextSessions.length === state.sessions.length) return false
  state.sessions = nextSessions
  await writeSessions(state)
  return true
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

function validateAuthInput({ name = '', email = '', password = '', mode }) {
  if (!normalizeEmail(email)) {
    const error = new Error('Email is required')
    error.statusCode = 400
    throw error
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email))) {
    const error = new Error('Enter a valid email address')
    error.statusCode = 400
    throw error
  }
  if (mode === 'signup' && !String(name).trim()) {
    const error = new Error('Full name is required')
    error.statusCode = 400
    throw error
  }
  if (String(password).length < 8) {
    const error = new Error('Password must be at least 8 characters')
    error.statusCode = 400
    throw error
  }
}

async function hashPassword(password) {
  const salt = randomHex(16)
  const derived = await derivePasswordHash(password, salt)
  return `pbkdf2:${salt}:${derived}`
}

async function verifyPassword(password, stored) {
  const parts = String(stored ?? '').split(':')
  const [, salt, expectedHash] = parts[0] === 'pbkdf2' ? parts : ['', parts[0], parts[1]]
  if (!salt || !expectedHash) return false
  if (parts[0] !== 'pbkdf2') return false
  const actualHash = await derivePasswordHash(password, salt)
  return timingSafeEqualHex(actualHash, expectedHash)
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  }
}

async function readUsers() {
  await ensureRuntime()
  if (!existsSync(usersFile())) return { users: [] }
  const raw = await readFile(usersFile(), 'utf8')
  const parsed = raw.trim() ? JSON.parse(raw) : {}
  return { users: Array.isArray(parsed.users) ? parsed.users : [] }
}

async function writeUsers(state) {
  await ensureRuntime()
  await writeFile(usersFile(), JSON.stringify(state, null, 2))
}

async function readSessions() {
  await ensureRuntime()
  if (!existsSync(sessionsFile())) return { sessions: [] }
  const raw = await readFile(sessionsFile(), 'utf8')
  const parsed = raw.trim() ? JSON.parse(raw) : {}
  const now = Date.now()
  return {
    sessions: Array.isArray(parsed.sessions)
      ? parsed.sessions.filter((session) => Date.parse(session.expiresAt) > now)
      : [],
  }
}

async function writeSessions(state) {
  await ensureRuntime()
  await writeFile(sessionsFile(), JSON.stringify(state, null, 2))
}

async function ensureRuntime() {
  await mkdir(getRuntimeDir(), { recursive: true })
}

function randomHex(byteLength) {
  const values = new Uint8Array(byteLength)
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random source is not available')
  }
  globalThis.crypto.getRandomValues(values)
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('')
}

async function derivePasswordHash(password, salt) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto PBKDF2 is not available')
  }
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(password)),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: Buffer.from(salt, 'hex'),
      iterations: passwordIterations,
    },
    key,
    512,
  )
  return Buffer.from(bits).toString('hex')
}

function timingSafeEqualHex(left, right) {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return diff === 0
}
