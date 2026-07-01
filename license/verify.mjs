import crypto from 'node:crypto'
import { PUBLIC_KEY_PEM } from './publicKey.mjs'
import { machineId } from './machineId.mjs'

/**
 * Verify a license string of the form "<b64url(payloadJson)>.<b64url(sig)>".
 * Checks, in order: Ed25519 signature (so it can't be forged or edited without
 * our private key), expiry, and machine binding. Returns { ok, reason?, payload? }.
 *
 * @param {string} license
 * @param {{ now?: string|Date, machine?: string }} [opts]  test hooks / override
 */
export function verifyLicense(license, opts = {}) {
  try {
    const parts = String(license || '').trim().split('.')
    if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed license' }
    const payloadBytes = Buffer.from(parts[0], 'base64url')
    const sig = Buffer.from(parts[1], 'base64url')
    const key = crypto.createPublicKey(PUBLIC_KEY_PEM)
    if (!crypto.verify(null, payloadBytes, key, sig)) {
      return { ok: false, reason: 'signature invalid — not issued by us, or tampered' }
    }
    const payload = JSON.parse(payloadBytes.toString('utf8'))
    const now = opts.now ? new Date(opts.now) : new Date()
    if (payload.expiry && new Date(payload.expiry).getTime() < now.getTime()) {
      return { ok: false, reason: `license expired on ${String(payload.expiry).slice(0, 10)}`, payload }
    }
    const here = opts.machine ?? machineId()
    if (payload.machine && payload.machine !== here) {
      return { ok: false, reason: 'license is bound to a different machine', payload }
    }
    return { ok: true, payload }
  } catch (e) {
    return { ok: false, reason: 'license error: ' + String(e?.message ?? e) }
  }
}
