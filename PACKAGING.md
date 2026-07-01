# Packaging & Licensing (Windows first, Mac-ready)

Ship FORGE to testers as a signed-per-tester desktop app. The app runs on
the tester's machine and drives **their own** local `claude` / `codex` CLIs, so
you never pay for their usage.

> **Threat model.** Local licensing is *deterrence*, not unbreakable DRM (it's
> JS on their machine). The goal: casual copying is annoying, keys can't be
> forged/edited, and each key is per-tester + expiring + machine-locked.

---

## 0. Prerequisites

- **You (builder):** Node 20+, Windows for the `.exe` (a Mac or CI for the `.dmg`).
- **Testers:** the `claude` CLI (and/or the ChatGPT/Codex extension) installed &
  logged in — the app spawns their local agents, same as the dev build.

## 1. One-time: signing keys (already done)

`node scripts/gen-keys.mjs` created `.secrets/ed25519-private.pem` (**KEEP SECRET
— never commit or ship**) and embedded the public key in `license/publicKey.mjs`.
`.secrets/` is git-ignored. Back up the private key somewhere safe; if you lose
it you can't issue new licenses (and if it leaks, anyone can).

## 2. Build the Windows installer

```bash
npm install          # pulls electron, electron-builder, esbuild (first time only)
npm run dist:win     # vite build → esbuild server → electron-builder --win
```

Output: `release/FORGE-Setup-0.1.0.exe` — hand that to testers.

**Quick local smoke test (no installer):**
```bash
npm run electron:dev   # builds web+server, launches the Electron app locally
```

## 3. Activate a tester

1. Tester installs & launches → sees the **Activation** screen with their
   **machine ID**. They copy it and send it to you.
2. You mint a key:
   ```bash
   node scripts/issue-license.mjs --tester "Alice" --machine <their-id> --days 30
   ```
   (omit `--machine` for a non-locked trial key; add `--out alice.license` to save a file)
3. Send them the key. They paste it into the Activation screen → **Activate** →
   the app boots. The key is stored at `%APPDATA%/FORGE/license.key`.

Expired or moved-to-another-machine keys drop back to the Activation screen.

## 4. macOS later (same codebase)

On a Mac (or a GitHub Actions `macos` runner): `npm run dist:mac` → `.dmg`.
Note: unsigned macOS apps are blocked by Gatekeeper — testers must right-click →
Open, **or** you sign+notarize with an Apple Developer ID ($99/yr). Windows
unsigned works but SmartScreen shows an "unknown publisher" warning (a cheap
Authenticode cert removes it).

---

## How it's wired (for future-you)

- **`electron/main.mjs`** — on launch: verify `license.key` (signature + expiry +
  this machine) → if OK, start the bundled backend on a free port and load it;
  else show `activation.html`. Sets `FT_STORE=json`, `FT_DATA_DIR`/`FT_WORKSPACE`
  → the OS user-data dir, `FT_DIST` → the bundled frontend.
- **`license/`** — `machineId` (hostname+MAC+cpu hash), `verify` (Ed25519 +
  expiry + machine), plus `scripts/gen-keys` & `scripts/issue-license`.
- **Backend** — `server/index.ts` exports `startServer()` and serves the built
  SPA when `dist/` exists (dev is untouched — Vite serves there). Bundled by
  esbuild (`--packages=external`) to `dist-electron/server.mjs`.
- **Run store** — native `better-sqlite3` in dev; **pure-JS JSON store** in the
  packaged app (`FT_STORE=json`), so the app ships **zero native modules** → no
  per-Electron native rebuild. `better-sqlite3` is excluded from the build.
- **`asar: false`** for a reliable first build (avoids ESM-in-asar edge cases).
  Once it's working you can try `asar: true` to bundle the source into one archive.

## Troubleshooting

- **App window blank / can't reach API** — the backend didn't start; run
  `npm run electron:dev` from a terminal to see its logs.
- **`Cannot find package '…'` at runtime** — a runtime dep wasn't packaged; it
  must be in `dependencies` (not `devDependencies`) so electron-builder includes it.
- **Want it smaller / source hidden** — flip `asar: true`; if the server fails to
  load from the archive, add `"asarUnpack": ["dist-electron/**", "dist/**"]`.
- **Providers show false in the packaged app** — the tester's `claude`/`codex`
  aren't on the GUI process PATH; have them install the CLI and re-launch.
