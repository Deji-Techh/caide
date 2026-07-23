
# CAIDE Preview Runtime

A dedicated, disposable runtime for worldwide CAIDE mobile previews.

## Security boundary

Deploy this as a **separate service** from `services/share-service`.

Generated projects execute arbitrary package scripts. The runtime container must
not receive PostgreSQL, R2, GitHub, payment, or other application secrets. It
only needs the two variables below.

## Environment variables

```text
PREVIEW_RUNTIME_TOKEN=<long random service token>
PUBLIC_BASE_URL=https://your-preview-runtime.example.com
PORT=10000
PREVIEW_MAX_SESSIONS=2
```

The desktop build uses:

```text
CAIDE_PREVIEW_API_URL=https://your-preview-runtime.example.com
CAIDE_PREVIEW_API_TOKEN=<same token>
```

## Render deployment

Create a new Docker web service:

```text
Root directory: services/preview-runtime
Dockerfile path: ./Dockerfile
Health check path: /health
```

The included multi-stage Dockerfile installs dependencies, builds TypeScript,
and produces the runtime image:

```bash
docker build -t caide-preview-runtime .
```

Render can build it directly from `services/preview-runtime/Dockerfile`; no
committed `dist/` directory is required.

## Operational limits

The first release is intentionally small and single-node:

- 2 concurrent preview sessions by default;
- 30 MB project limit;
- 2 MB per file;
- 24-hour maximum lifetime;
- ephemeral workspaces;
- isolated environment with no service credentials passed to child processes.

Scale by running multiple dedicated runtime instances behind a scheduler. Do not
turn the share service into an application executor.
