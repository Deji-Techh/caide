import { ipcMain, IpcMainInvokeEvent } from "electron";
import { z } from "zod";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";
import {
  createIpcErrorEnvelope,
  createIpcSuccessEnvelope,
  type IpcContract,
} from "../contracts/core";
import { sendTelemetryException } from "../utils/telemetry";

type RegisteredHandler = (
  event: IpcMainInvokeEvent,
  ...args: any[]
) => Promise<unknown>;

// Registry of raw handler implementations keyed by channel. Lets unit tests
// invoke a handler directly (after calling the module's register*Handlers())
// without mocking electron or introspecting ipcMain.handle calls.
const registeredHandlers = new Map<string, RegisteredHandler>();

export function registerLegacyIpcHandler(
  channel: string,
  handler: RegisteredHandler,
): void {
  registeredHandlers.set(channel, handler);
}

export function getRegisteredHandlerForTesting(
  channel: string,
): RegisteredHandler {
  const handler = registeredHandlers.get(channel);
  if (!handler) {
    throw new Error(
      `No handler registered for channel "${channel}". Did you call the module's register*Handlers() function first?`,
    );
  }
  return handler;
}

export interface IpcRegistrationAudit {
  expectedChannels: string[];
  registeredChannels: string[];
  missingChannels: string[];
}

export function getRegisteredIpcChannelsForTesting(): string[] {
  return [...registeredHandlers.keys()].sort();
}

export function auditIpcRegistration(
  contracts: Iterable<IpcContract<string, z.ZodType, z.ZodType>>,
): IpcRegistrationAudit {
  const expectedChannels = [
    ...new Set([...contracts].map((contract) => contract.channel)),
  ].sort();
  const registeredChannels = getRegisteredIpcChannelsForTesting();
  const registered = new Set(registeredChannels);
  return {
    expectedChannels,
    registeredChannels,
    missingChannels: expectedChannels.filter((channel) => !registered.has(channel)),
  };
}

export function assertIpcRegistrationCoverage(
  contracts: Iterable<IpcContract<string, z.ZodType, z.ZodType>>,
): void {
  const audit = auditIpcRegistration(contracts);
  if (audit.missingChannels.length === 0) return;
  throw new Error(
    [
      "CAIDE IPC startup audit failed.",
      "The renderer exposes contracts that have no main-process handler:",
      ...audit.missingChannels.map((channel) => `  - ${channel}`),
      "Run `npm run verify:ipc` before packaging.",
    ].join("\n"),
  );
}

/**
 * Creates a typed IPC handler from a contract.
 * Provides runtime validation of inputs and type-safe handler implementation.
 *
 * @example
 * createTypedHandler(appContracts.createApp, async (_event, params) => {
 *   // params is typed as z.infer<CreateAppParamsSchema>
 *   // return type is enforced as z.infer<CreateAppResultSchema>
 *   const [app] = await db.insert(apps).values({ name: params.name }).returning();
 *   return { app, chatId: chat.id };
 * });
 */
export function createTypedHandler<
  TChannel extends string,
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
>(
  contract: IpcContract<TChannel, TInput, TOutput>,
  handler: (
    event: IpcMainInvokeEvent,
    input: z.infer<TInput>,
  ) => Promise<z.infer<TOutput>>,
): void {
  registeredHandlers.set(contract.channel, handler);
  // Optional chaining: ipcMain is undefined in unit tests (no electron runtime).
  ipcMain?.handle(
    contract.channel,
    async (event: IpcMainInvokeEvent, rawInput: unknown) => {
      // Runtime validation of input
      const parsed = contract.input.safeParse(rawInput);
      if (!parsed.success) {
        const errorMessage = parsed.error.issues
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return createIpcErrorEnvelope(
          new DyadError(
            `[${contract.channel}] Invalid input: ${errorMessage}`,
            DyadErrorKind.Validation,
          ),
        );
      }

      let result: z.infer<TOutput>;
      try {
        result = await handler(event, parsed.data);
      } catch (err) {
        sendTelemetryException(err, { ipc_channel: contract.channel });
        return createIpcErrorEnvelope(err);
      }

      // Validate output in development mode only (catches handler bugs without prod overhead)
      if (process.env.NODE_ENV === "development") {
        const outputParsed = contract.output.safeParse(result);
        if (!outputParsed.success) {
          const errorMessage = outputParsed.error.issues
            .map((e) => `${e.path.join(".")}: ${e.message}`)
            .join("; ");
          console.error(
            `[${contract.channel}] Output validation warning: ${errorMessage}`,
          );
        }
      }

      return createIpcSuccessEnvelope(result);
    },
  );
}

/**
 * Creates a typed IPC handler with logging support.
 * Combines typed handling with the existing logging infrastructure.
 *
 * @example
 * const handle = createLoggedTypedHandler(logger);
 * handle(appContracts.createApp, async (_event, params) => {
 *   return { app, chatId: chat.id };
 * });
 */
export function createLoggedTypedHandler(logger: {
  info: (msg: string) => void;
  error: (msg: string, err?: any) => void;
}) {
  return function <
    TChannel extends string,
    TInput extends z.ZodType,
    TOutput extends z.ZodType,
  >(
    contract: IpcContract<TChannel, TInput, TOutput>,
    handler: (
      event: IpcMainInvokeEvent,
      input: z.infer<TInput>,
    ) => Promise<z.infer<TOutput>>,
  ): void {
    registeredHandlers.set(contract.channel, handler);
    // Optional chaining: ipcMain is undefined in unit tests (no electron runtime).
    ipcMain?.handle(
      contract.channel,
      async (event: IpcMainInvokeEvent, rawInput: unknown) => {
        // Runtime validation of input
        const parsed = contract.input.safeParse(rawInput);
        if (!parsed.success) {
          const errorMessage = parsed.error.issues
            .map((e) => `${e.path.join(".")}: ${e.message}`)
            .join("; ");
          const error = new DyadError(
            `[${contract.channel}] Invalid input: ${errorMessage}`,
            DyadErrorKind.Validation,
          );
          logger.error(`[${contract.channel}] Invalid input`, error);
          return createIpcErrorEnvelope(error);
        }

        try {
          logger.info(`[${contract.channel}] Handling request`);
          const result = await handler(event, parsed.data);

          // Validate output in development mode only
          if (process.env.NODE_ENV === "development") {
            const outputParsed = contract.output.safeParse(result);
            if (!outputParsed.success) {
              const errorMessage = outputParsed.error.issues
                .map((e) => `${e.path.join(".")}: ${e.message}`)
                .join("; ");
              console.error(
                `[${contract.channel}] Output validation warning: ${errorMessage}`,
              );
            }
          }

          return createIpcSuccessEnvelope(result);
        } catch (err) {
          logger.error(`[${contract.channel}] Handler error`, err);
          sendTelemetryException(err, { ipc_channel: contract.channel });
          return createIpcErrorEnvelope(err);
        }
      },
    );
  };
}

/**
 * Helper to register multiple typed handlers at once.
 *
 * @example
 * registerTypedHandlers({
 *   [appContracts.createApp]: async (_event, params) => { ... },
 *   [appContracts.deleteApp]: async (_event, params) => { ... },
 * });
 */
export function registerTypedHandlers<
  T extends Record<string, IpcContract<string, z.ZodType, z.ZodType>>,
>(
  handlers: {
    [K in keyof T]: (
      event: IpcMainInvokeEvent,
      input: z.infer<T[K]["input"]>,
    ) => Promise<z.infer<T[K]["output"]>>;
  },
  contracts: T,
): void {
  for (const [key, contract] of Object.entries(contracts)) {
    const handler = handlers[key as keyof typeof handlers];
    if (handler) {
      // @ts-expect-error zod v4 type inference is not working correctly
      createTypedHandler(contract, handler);
    }
  }
}
