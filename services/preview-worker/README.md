# CAIDE Preview Worker

This is an internal worker in the multi-tenant preview architecture.

The desktop application never connects to internal worker endpoints and never
receives worker secrets. The control plane assigns a session and sends a
short-lived HMAC-scoped lease.

## One generated app per worker

Keep `WORKER_CAPACITY=1`. Generated project scripts are untrusted. The worker
supervisor launches them under UID/GID `10001` with a minimal environment and
without database, R2, GitHub, payment or control-plane credentials.

For more concurrent previews, deploy more worker services with different
`WORKER_ID`, `WORKER_NAME` and `WORKER_PUBLIC_BASE_URL` values.

## Required environment

```text
CONTROL_PLANE_URL=https://caide.onrender.com
WORKER_BOOTSTRAP_TOKEN=<same internal bootstrap token as control plane>
PREVIEW_LEASE_SIGNING_SECRET=<same lease secret as control plane>
WORKER_ID=<unique UUID for this worker>
WORKER_NAME=preview-worker-01
WORKER_PUBLIC_BASE_URL=https://caide-preview-worker-01.onrender.com
WORKER_CAPACITY=1
```

Do not add PostgreSQL, R2, GitHub, payment or share-service credentials.

## Render

```text
Root directory: services/preview-worker
Runtime: Docker
Dockerfile: ./Dockerfile
Health check: /health
```

Generate and commit `package-lock.json` before deployment:

```bash
cd services/preview-worker
npm install
npm run build
npm test
```
