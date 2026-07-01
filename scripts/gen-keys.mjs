// One-time: generate the Ed25519 signing keypair.
//   node scripts/gen-keys.mjs
// Writes .secrets/ (git-ignored). Paste the printed PUBLIC key into
// license/publicKey.mjs. NEVER commit or ship the private key.
import crypto from 'node:crypto'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'

if (existsSync('.secrets/ed25519-private.pem')) {
  console.error('Refusing to overwrite existing .secrets/ed25519-private.pem — delete it first if you really mean to.')
  process.exit(1)
}
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
mkdirSync('.secrets', { recursive: true })
const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' })
const pubPem = publicKey.export({ type: 'spki', format: 'pem' })
writeFileSync('.secrets/ed25519-private.pem', privPem)
writeFileSync('.secrets/ed25519-public.pem', pubPem)
console.log('Wrote .secrets/ed25519-private.pem (KEEP SECRET) + .secrets/ed25519-public.pem\n')
console.log('Paste this into license/publicKey.mjs:\n')
console.log('export const PUBLIC_KEY_PEM = `' + String(pubPem).trim() + '\n`')
