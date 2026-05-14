import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { buildKaggleOAuthEnv, getKaggleOAuthHome, getKaggleOAuthStatus } from './kaggleAuthRuntime.mjs'

const kaggleExe = resolve(process.env.LOCALAPPDATA ?? '', 'Packages/PythonSoftwareFoundation.Python.3.12_qbz5n2kfra8p0/LocalCache/local-packages/Python312/Scripts/kaggle.exe')

let activeLogin = null

export async function startKaggleOAuthLogin(force = false) {
  if (activeLogin && !isFinalState(activeLogin.status) && !force) {
    const error = new Error('A Kaggle OAuth login is already in progress')
    error.statusCode = 409
    throw error
  }

  if (activeLogin?.child && !isFinalState(activeLogin.status) && force) {
    try {
      activeLogin.child.kill()
    } catch {}
    activeLogin = null
  }

  await mkdir(getKaggleOAuthHome(), { recursive: true })
  const env = { ...process.env, ...buildKaggleOAuthEnv() }
  const args = ['auth', 'login', '--no-launch-browser']
  if (force) args.push('--force')

  const child = spawn(kaggleExe, args, {
    env,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  activeLogin = {
    id: `oauth-${Date.now().toString(36)}`,
    status: 'starting',
    url: '',
    logs: '',
    error: '',
    createdAt: new Date().toISOString(),
    child,
  }

  child.stdout.on('data', (chunk) => {
    appendLog(String(chunk))
  })
  child.stderr.on('data', (chunk) => {
    appendLog(String(chunk))
  })
  child.on('error', (error) => {
    if (!activeLogin) return
    activeLogin.status = 'failed'
    activeLogin.error = error.message
    activeLogin.logs += `\n${error.message}`
  })
  child.on('close', async (code) => {
    if (!activeLogin) return
    const status = await getKaggleOAuthStatus()
    activeLogin.status = code === 0 && status.configured ? 'completed' : 'failed'
    activeLogin.error = code === 0 ? '' : activeLogin.error || `Kaggle OAuth login exited with ${code}`
    activeLogin.child = null
  })

  await waitForOAuthPrompt()
  return getPublicState()
}

export async function confirmKaggleOAuthCode(code) {
  if (!activeLogin || !activeLogin.child || isFinalState(activeLogin.status)) {
    const error = new Error('No active Kaggle OAuth login session')
    error.statusCode = 404
    throw error
  }
  if (!code?.trim()) {
    const error = new Error('Verification code is required')
    error.statusCode = 400
    throw error
  }

  activeLogin.status = 'verifying'
  activeLogin.child.stdin.write(`${code.trim()}\n`)
  await waitForCompletion()
  return getPublicState()
}

export async function getKaggleOAuthSessionStatus() {
  return getPublicState()
}

export async function revokeKaggleOAuthLogin() {
  const env = { ...process.env, ...buildKaggleOAuthEnv() }
  const output = await runKaggle(['auth', 'revoke'], env)
  activeLogin = null
  return { revoked: true, output }
}

function appendLog(chunk) {
  if (!activeLogin) return
  activeLogin.logs += chunk
  const urlMatch = chunk.match(/https:\/\/\S+/)
  if (urlMatch) {
    activeLogin.url = urlMatch[0]
    if (activeLogin.status === 'starting') activeLogin.status = 'awaiting_code'
  }
}

async function waitForOAuthPrompt() {
  const started = Date.now()
  while (Date.now() - started < 15000) {
    if (!activeLogin || activeLogin.url || isFinalState(activeLogin.status)) return
    await sleep(150)
  }
}

async function waitForCompletion() {
  const started = Date.now()
  while (Date.now() - started < 30000) {
    if (!activeLogin || isFinalState(activeLogin.status)) return
    await sleep(200)
  }
}

function getPublicState() {
  return {
    session: activeLogin ? {
      id: activeLogin.id,
      status: activeLogin.status,
      url: activeLogin.url,
      logs: activeLogin.logs.trim(),
      error: activeLogin.error,
      createdAt: activeLogin.createdAt,
    } : null,
  }
}

function isFinalState(status) {
  return status === 'completed' || status === 'failed'
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

function runKaggle(args, env) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(kaggleExe, args, {
      env,
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += String(chunk) })
    child.stderr.on('data', (chunk) => { stderr += String(chunk) })
    child.on('error', rejectPromise)
    child.on('close', (code) => {
      if (code === 0) resolvePromise((stdout || stderr).trim())
      else rejectPromise(new Error((stderr || stdout || `Kaggle command failed with exit code ${code}`).trim()))
    })
  })
}
