# CAIDE public preview and realtime collaboration

## Public preview

The QR button now creates a dedicated cloud sandbox and an expiring HTTPS link. The link works from any country or network. CAIDE uploads a filtered source snapshot, continuously synchronizes changes, and destroys the dedicated sandbox when the owner stops the preview.

Secret-bearing files are excluded, including `.env`, private keys, credential files, service-account files, and package-manager authentication files. Environment templates such as `.env.example` remain shareable.

The desktop application stores the active preview descriptor in its user-data directory with owner-only file permissions. This allows CAIDE to reconnect to and revoke a preview after restarting.

## Collaboration

Collaboration sessions use PostgreSQL as the authoritative event and file store. The desktop app maintains an authenticated SSE connection and sends mutations through versioned HTTP events.

Supported capabilities:

- owner, editor, and viewer roles;
- simultaneous Monaco text editing with revision checks and non-overlapping edit transformation;
- remote cursors, selections, and active-file presence;
- project chat;
- file creation, deletion, rename, and complete snapshot synchronization;
- AI run activity and automatic synchronization of AI-generated file changes;
- owner-created checkpoints and restore;
- owner-approved safe Git/package-script commands;
- reconnection after network loss and desktop restart;
- expiring and revocable invitation tokens.

## Database migration

Apply the migration before deploying the updated service:

```bash
psql "$DATABASE_URL" -f migrations/002_collaboration.sql
```

The Render service remains configured with:

```text
Root directory: services/share-service
Build command: npm ci && npm run build
Start command: npm start
```

## Deployment order

1. Apply `migrations/002_collaboration.sql` to the Render PostgreSQL database.
2. Deploy the share service patches and verify `/healthz`.
3. Build and install the updated CAIDE desktop application.
4. Start a public preview and verify the HTTPS link over mobile data.
5. Start a collaboration session, join from a second CAIDE installation, edit the same file, restore a checkpoint, and stop the session.

## Security boundaries

- Public preview viewers receive only the sandbox URL, not project source or collaboration credentials.
- Collaboration access tokens are random, stored as hashes on the server, and persisted locally with owner-only filesystem permissions.
- Remote paths are normalized and cannot be absolute, contain `..`, or escape the project root.
- Viewers cannot mutate project files.
- Remote command requests never execute automatically. Only the owner can approve them, and execution is restricted to read-only Git commands and declared package scripts.
- Payload, file, project, checkpoint, and session lifetime limits are enforced server-side.
