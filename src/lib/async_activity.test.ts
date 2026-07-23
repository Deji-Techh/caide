import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginAsyncActivity,
  getAsyncActivityLabel,
  getAsyncActivitySnapshot,
  resetAsyncActivityForTesting,
  subscribeAsyncActivity,
} from "./async_activity";

describe("async activity tracking", () => {
  beforeEach(() => resetAsyncActivityForTesting());

  it("tracks overlapping IPC work and finishes idempotently", () => {
    const finishShare = beginAsyncActivity("share:create-remote");
    const finishCollaboration = beginAsyncActivity(
      "collaboration:create-session",
    );

    expect(getAsyncActivitySnapshot()).toMatchObject({
      count: 2,
      label: "Starting collaboration",
    });

    finishCollaboration();
    finishCollaboration();
    expect(getAsyncActivitySnapshot()).toMatchObject({
      count: 1,
      label: "Creating private share",
    });

    finishShare();
    expect(getAsyncActivitySnapshot().count).toBe(0);
  });

  it("does not surface automatic public-preview polling", () => {
    const finish = beginAsyncActivity("app:get-public-preview-status");
    expect(getAsyncActivitySnapshot().count).toBe(0);
    finish();
  });

  it("notifies subscribers whenever visible work changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAsyncActivity(listener);
    const finish = beginAsyncActivity("restart-app");
    finish();
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("creates readable fallback labels", () => {
    expect(getAsyncActivityLabel("figma:import-design-file")).toBe(
      "Import design file",
    );
  });
});
