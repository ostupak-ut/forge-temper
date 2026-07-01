// CommonJS main process (the reliable Electron entry). The license + bundled
// server are ESM (.mjs), loaded via dynamic import().
const { app, BrowserWindow, ipcMain, shell, clipboard } = require('electron')
const path = require('node:path')
const crypto = require('node:crypto')
const { pathToFileURL } = require('node:url')
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs')

const APP_ROOT = app.getAppPath() // project root (dev) or install dir (packaged)

let win = null
let backend = null // { address, close }
let lastReason = '' // why the activation screen is showing
let lic = null // { machineId, verifyLicense } — lazily imported ESM

async function loadLic() {
  if (lic) return lic
  const mid = await import(pathToFileURL(path.join(APP_ROOT, 'license', 'machineId.mjs')).href)
  const ver = await import(pathToFileURL(path.join(APP_ROOT, 'license', 'verify.mjs')).href)
  lic = { machineId: mid.machineId, verifyLicense: ver.verifyLicense }
  return lic
}

const licenseFile = () => path.join(app.getPath('userData'), 'license.key')
const readLicense = () => {
  try {
    return readFileSync(licenseFile(), 'utf8').trim()
  } catch {
    return ''
  }
}

const bindingFile = () => path.join(app.getPath('userData'), 'binding.json')
const keyHash = (license) => crypto.createHash('sha256').update(license).digest('hex').slice(0, 16)
const readBinding = () => {
  try {
    return JSON.parse(readFileSync(bindingFile(), 'utf8'))
  } catch {
    return null
  }
}

/**
 * Bind-on-first-use: an UNBOUND key (no machine in the payload) locks to the
 * first machine that sees it, and is rejected anywhere else. Hard-locked keys
 * (machine set at issue) are enforced by verifyLicense itself, so pass through.
 */
async function bindCheck(license, payload) {
  if (payload && payload.machine) return { ok: true }
  const { machineId } = await loadLic()
  const here = machineId()
  const kh = keyHash(license)
  const b = readBinding()
  if (b && b.keyHash === kh) {
    return b.machine === here
      ? { ok: true }
      : { ok: false, reason: 'This license is already activated on another machine.' }
  }
  try {
    writeFileSync(bindingFile(), JSON.stringify({ keyHash: kh, machine: here, boundAt: new Date().toISOString() }))
  } catch {
    /* best-effort */
  }
  return { ok: true }
}

async function checkLicense() {
  const { verifyLicense } = await loadLic()
  const l = readLicense()
  if (!l) return { ok: false, reason: 'No license installed yet.' }
  const res = verifyLicense(l)
  if (!res.ok) return res
  const bound = await bindCheck(l, res.payload)
  return bound.ok ? res : bound
}

async function startBackend() {
  if (backend) return backend
  process.env.FT_STORE = 'json' // packaged app ships no native modules
  process.env.FT_PORT = '0' // OS-assigned free port
  process.env.FT_HOST = '127.0.0.1'
  process.env.FT_DATA_DIR = path.join(app.getPath('userData'), 'data')
  process.env.FT_WORKSPACE = path.join(app.getPath('userData'), 'workspace')
  process.env.FT_DIST = path.join(APP_ROOT, 'dist')
  mkdirSync(process.env.FT_WORKSPACE, { recursive: true })
  const serverUrl = pathToFileURL(path.join(APP_ROOT, 'dist-electron', 'server.mjs')).href
  const mod = await import(serverUrl)
  backend = await mod.startServer()
  return backend
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    show: true,
    center: true,
    backgroundColor: '#0b0b0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.once('ready-to-show', () => {
    win.show()
    win.focus()
    win.moveTop()
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

async function launchApp() {
  const b = await startBackend()
  await win.loadURL(b.address)
}

async function gate() {
  createWindow()
  try {
    const res = await checkLicense()
    if (res.ok) {
      await launchApp()
      return
    }
    lastReason = res.reason || 'License required.'
  } catch (e) {
    lastReason = 'startup error: ' + String((e && e.message) || e)
  }
  await win.loadFile(path.join(__dirname, 'activation.html'))
}

// --- Activation IPC ---------------------------------------------------------
ipcMain.handle('lic:info', async () => {
  const { machineId } = await loadLic()
  return { machine: machineId(), reason: lastReason }
})
ipcMain.handle('lic:copy', (_e, text) => {
  clipboard.writeText(String(text ?? ''))
  return true
})
ipcMain.handle('lic:submit', async (_e, text) => {
  const { verifyLicense } = await loadLic()
  const t = String(text ?? '').trim()
  const res = verifyLicense(t)
  if (!res.ok) return { ok: false, reason: res.reason }
  const bound = await bindCheck(t, res.payload)
  if (!bound.ok) return { ok: false, reason: bound.reason }
  try {
    mkdirSync(path.dirname(licenseFile()), { recursive: true })
    writeFileSync(licenseFile(), t)
  } catch (e) {
    return { ok: false, reason: 'could not save license: ' + String((e && e.message) || e) }
  }
  await launchApp()
  return { ok: true, tester: res.payload && res.payload.tester, expiry: res.payload && res.payload.expiry }
})

app.whenReady().then(gate)
app.on('window-all-closed', async () => {
  try {
    await backend?.close()
  } catch {
    /* ignore */
  }
  app.quit()
})
