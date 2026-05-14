import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const runtimeDir = resolve(process.cwd(), '.test-runtime/auth-store')
process.env.FINETUNA_RUNTIME_DIR = '.test-runtime/auth-store'

const { authenticateUser, createSession, createUser, deleteSession, getSessionUser } = await import('../server/authStore.mjs')

test.beforeEach(async () => {
  await mkdir(runtimeDir, { recursive: true })
  await writeFile(resolve(runtimeDir, 'users.json'), JSON.stringify({ users: [] }, null, 2))
  await writeFile(resolve(runtimeDir, 'sessions.json'), JSON.stringify({ sessions: [] }, null, 2))
})

test.after(async () => {
  if (existsSync(runtimeDir)) await rm(runtimeDir, { recursive: true, force: true })
})

test('creates users, authenticates them, and resolves sessions', async () => {
  const created = await createUser({
    name: 'Ayush Sharma',
    email: 'Ayush@example.com',
    password: 'supersecret123',
  })

  const authenticated = await authenticateUser({
    email: 'ayush@example.com',
    password: 'supersecret123',
  })

  const session = await createSession(created.id)
  const resolved = await getSessionUser(session.token)

  assert.equal(authenticated.email, 'ayush@example.com')
  assert.equal(resolved?.user.id, created.id)
  assert.equal(resolved?.user.name, 'Ayush Sharma')

  const deleted = await deleteSession(session.token)
  assert.equal(deleted, true)
  assert.equal(await getSessionUser(session.token), null)
})

test('rejects duplicate emails and wrong passwords', async () => {
  await createUser({
    name: 'Ayush Sharma',
    email: 'ayush@example.com',
    password: 'supersecret123',
  })

  await assert.rejects(
    createUser({
      name: 'Another User',
      email: 'Ayush@example.com',
      password: 'supersecret123',
    }),
    /already exists/,
  )

  await assert.rejects(
    authenticateUser({
      email: 'ayush@example.com',
      password: 'wrongpass1',
    }),
    /Invalid email or password/,
  )
})
