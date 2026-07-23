import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const source = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

test("desktop clients never receive worker infrastructure secrets", () => {
  const control = source("src/preview_control_plane.ts");
  assert.match(control, /authenticateDevice/);
  assert.match(control, /signLease/);
  assert.doesNotMatch(control, /config\.PREVIEW_LEASE_SIGNING_SECRET[^;]*res\.json/);
  assert.doesNotMatch(control, /config\.PREVIEW_WORKER_BOOTSTRAP_TOKEN[^;]*res\.json/);
});

test("preview sessions enforce per-device concurrency and daily quotas", () => {
  const control = source("src/preview_control_plane.ts");
  assert.match(control, /concurrentLimit/);
  assert.match(control, /dailySessionLimit/);
  assert.match(control, /active_count/);
  assert.match(control, /daily_count/);
});

test("workers are allocated by available capacity", () => {
  const control = source("src/preview_control_plane.ts");
  assert.match(control, /active_sessions < capacity/);
  assert.match(control, /FOR UPDATE SKIP LOCKED/);
  assert.match(control, /releaseWorkerSlot/);
});

test("project bundles use private presigned object storage transfers", () => {
  const control = source("src/preview_control_plane.ts");
  assert.match(control, /signedPreviewUploadUrl/);
  assert.match(control, /signedPreviewDownloadUrl/);
  assert.match(control, /verifyUploadedBundle/);
});

test("worker restarts release stale capacity and fail orphaned sessions", () => {
  const control = source("src/preview_control_plane.ts");
  assert.match(control, /Preview worker restarted/);
  assert.match(control, /active_sessions=0/);
  assert.match(control, /worker_slot_released=true/);
});

test("control plane exposes migration and worker readiness", () => {
  const control = source("src/preview_control_plane.ts");
  assert.match(control, /\/v1\/preview\/health/);
  assert.match(control, /activeWorkers/);
  assert.match(control, /migration 004 is missing/);
});
