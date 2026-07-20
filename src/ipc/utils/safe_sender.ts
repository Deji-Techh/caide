import type { WebContents } from "electron";
import log from "electron-log";
import { emit } from "./event_bus";

/**
 * Sends an IPC message to the renderer only if the provided `WebContents` is
 * still alive. This prevents `Object has been destroyed` errors that can occur
 * when asynchronous callbacks attempt to communicate after the window has
 * already been closed (e.g. during e2e test teardown).
 *
 * Also emits the message to the main-process event bus so other windows
 * (e.g. the notch) can subscribe to relevant events.
 */
export function safeSend(
  sender: WebContents | null | undefined,
  channel: string,
  ...args: unknown[]
): void {
  if (!sender) return;
  if (sender.isDestroyed()) return;
  // @ts-ignore – `isCrashed` exists at runtime but is not in the type defs
  if (typeof sender.isCrashed === "function" && sender.isCrashed()) return;

  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore – allow variadic args beyond `data`
    sender.send(channel, ...args);
  } catch (error) {
    log.debug(
      `safeSend: failed to send on channel "${channel}" because: ${(error as Error).message}`,
    );
  }

  // Emit to main-process event bus for other windows (e.g. notch) to consume.
  // Only emit for known broadcast channels to avoid flooding the bus.
  if (args.length === 1) {
    emit(channel, args[0]);
  }
}
