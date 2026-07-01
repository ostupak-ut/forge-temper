// Embedded Ed25519 PUBLIC key. The private counterpart lives ONLY in .secrets/
// (git-ignored, never shipped). Regenerate both with: node scripts/gen-keys.mjs
// then paste the printed key here.
export const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAXrGOBbC+/TjYc7HEJ6UQxu0fkwdyAeDFYkBKWTQtYyU=
-----END PUBLIC KEY-----
`
