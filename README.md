# CAIDE Mobile Builder

CAIDE Mobile Builder combines CAIDE's mobile-first visual workspace with Dyad's local Electron, AI, database, Git, preview, provider, and packaging infrastructure.

## Architecture

- **Frontend:** CAIDE's dense mobile-builder workspace and visual editor interaction model.
- **Backend and desktop runtime:** Dyad's Electron main process, IPC handlers, SQLite/Drizzle data layer, workers, provider integrations, Git tooling, preview runtime, and release makers.
- **Generation flow:** CAIDE's prompt controls call Dyad's existing app creation and chat streaming pipeline.

The original CAIDE backend is intentionally not included.

## Development

Requires Node.js 24.

```bash
npm ci
npm run dev
```

## Verification

```bash
npm run ts:workers
npm run test
npm run make
```

## Desktop artifacts

The `Build desktop artifacts` GitHub Actions workflow builds:

- Linux x64 AppImage
- Windows x64 Squirrel installer (`.exe`)

Tagged builds (`v*`) are attached to a GitHub Release.

## License

The Dyad-derived source retains its upstream licenses. See [LICENSE](./LICENSE), [NOTICE](./NOTICE), and [src/pro/LICENSE](./src/pro/LICENSE).
