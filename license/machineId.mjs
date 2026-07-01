import os from 'node:os'
import crypto from 'node:crypto'

/**
 * A stable-ish fingerprint for THIS machine: hostname + platform + arch + first
 * real (non-internal) MAC + CPU model, hashed. Used to bind a license to one
 * machine so a key can't be freely shared. Not bulletproof (MAC/hostname can
 * change), but plenty to keep testers honest.
 */
export function machineId() {
  let mac = ''
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list ?? []) {
      if (!ni.internal && ni.mac && ni.mac !== '00:00:00:00:00:00') {
        mac = ni.mac
        break
      }
    }
    if (mac) break
  }
  const raw = [os.hostname(), os.platform(), os.arch(), os.cpus()[0]?.model ?? '', mac].join('|')
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32)
}
