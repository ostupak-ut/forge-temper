// Issue a signed license for a tester.
//   node scripts/issue-license.mjs --tester "Alice" --machine <id> --days 30 [--out alice.license]
// --machine is the tester's machine id (shown on their activation screen). Omit
// it for a NON machine-locked key. Requires .secrets/ed25519-private.pem.
import crypto from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]
}
const tester = args.tester || 'unnamed'
const machine = args.machine || '' // empty = not machine-locked
const days = Number(args.days || 30)

let priv
try {
  priv = crypto.createPrivateKey(readFileSync('.secrets/ed25519-private.pem'))
} catch {
  console.error('Missing .secrets/ed25519-private.pem — run: node scripts/gen-keys.mjs')
  process.exit(1)
}

const issued = new Date()
const expiry = new Date(issued.getTime() + days * 86400_000)
const payload = { v: 1, tester, machine, issued: issued.toISOString(), expiry: expiry.toISOString() }
const payloadBytes = Buffer.from(JSON.stringify(payload))
const sig = crypto.sign(null, payloadBytes, priv)
const license = payloadBytes.toString('base64url') + '.' + sig.toString('base64url')

if (args.out) {
  writeFileSync(args.out, license)
  console.log('Wrote', args.out)
}
console.log(
  `\nLicense for "${tester}" — expires ${expiry.toISOString().slice(0, 10)}${machine ? ', machine-locked' : ' (NOT machine-locked)'}:\n`,
)
console.log(license)
