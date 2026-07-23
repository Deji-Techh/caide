# CAIDE Preview Control Plane

This service is the public multi-tenant API. Desktop clients never receive a
worker bootstrap token or worker credential.

## Beta identity model

Each CAIDE installation is automatically registered as an isolated tenant and
receives its own revocable access token. This supports many users immediately
without sharing one infrastructure secret. Human accounts and cross-device
login can be added later without changing the preview-session API.

## Environment

```text
DATABASE_URL=<private PostgreSQL URL>
PREVIEW_WORKER_BOOTSTRAP_TOKEN=<long internal secret>
PUBLIC_API_URL=https://caide-preview-api.onrender.com
PORT=10000
```

Run migration `004_preview_control_plane.sql` against the same PostgreSQL
database used by the share service, or a separate preview database.

## Render

Create a Node web service:

```text
Root directory: services/preview-control-plane
Build command: npm install && npm run build
Start command: npm start
Health check: /health
```
