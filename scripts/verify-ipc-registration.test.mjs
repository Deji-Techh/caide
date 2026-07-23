import assert from "node:assert/strict";
import test from "node:test";
import {
  auditDefinitions,
  collectContractDefinitions,
  collectLiteralHandlerChannels,
  collectRegisteredContractReferences,
  collectRegistryGroupNames,
  maskCommentsAndStrings,
} from "./verify-ipc-registration.mjs";

test("collects contract groups from the central registry", () => {
  const groups = collectRegistryGroupNames(`
    export const ipcContractGroups = {
      appContracts,
      collaborationContracts,
      renamed: shareContracts,
    } as const;
  `);
  assert.deepEqual(groups, [
    "appContracts",
    "collaborationContracts",
    "shareContracts",
  ]);
});

test("collects literal channels from defineContract entries", () => {
  const definitions = collectContractDefinitions(
    `
      export const appContracts = {
        createApp: defineContract({
          channel: "create-app",
          input: z.object({ nested: z.string().regex(/^(foo|bar){1,2}$/) }),
          output: z.void(),
        }),
        startPreview: defineContract({
          channel: 'app:start-public-preview',
          input: z.void(),
          output: z.string(),
        }),
      } as const;
    `,
    "appContracts",
  );
  assert.deepEqual(
    definitions.map(({ member, channel }) => ({ member, channel })),
    [
      { member: "createApp", channel: "create-app" },
      { member: "startPreview", channel: "app:start-public-preview" },
    ],
  );
});

test("finds explicit and whole-group handler registrations", () => {
  const definitionsByGroup = new Map([
    [
      "appContracts",
      [
        { group: "appContracts", member: "createApp", channel: "create-app" },
        { group: "appContracts", member: "deleteApp", channel: "delete-app" },
      ],
    ],
    [
      "shareContracts",
      [{ group: "shareContracts", member: "create", channel: "share:create" }],
    ],
  ]);
  const references = collectRegisteredContractReferences(
    [
      {
        source: `
          createTypedHandler(appContracts.createApp, handler);
          // appContracts.deleteApp must not count from a comment.
          const label = "shareContracts.create";
          registerTypedHandlers(allShareHandlers, shareContracts);
        `,
      },
    ],
    definitionsByGroup,
  );
  assert.deepEqual([...references].sort(), [
    "appContracts.createApp",
    "shareContracts.create",
  ]);
});

test("finds legacy logged handlers and direct ipcMain handlers", () => {
  const channels = collectLiteralHandlerChannels(`
    const handle = createLoggedHandler(logger);
    const testHandle = createTestOnlyLoggedHandler(logger);
    handle("create-app", async () => {});
    testHandle("test:ping", async () => {});
    ipcMain.handle("share:create", async () => {});
    other.handle("not-an-ipc-registration", async () => {});
    const label = 'handle("not-real")';
    // handle("also-not-real", async () => {});
  `);
  assert.deepEqual([...channels].sort(), [
    "create-app",
    "share:create",
    "test:ping",
  ]);
});

test("allows the intentional check-app-name compatibility alias", () => {
  const definitions = [
    { group: "appContracts", member: "checkAppName", channel: "check-app-name" },
    { group: "importContracts", member: "checkAppName", channel: "check-app-name" },
  ];
  const audit = auditDefinitions(
    definitions,
    new Set(["appContracts.checkAppName", "importContracts.checkAppName"]),
  );
  assert.deepEqual(audit.duplicateChannels, []);
});

test("reports missing contracts and duplicate channels", () => {
  const definitions = [
    { group: "appContracts", member: "one", channel: "same" },
    { group: "appContracts", member: "two", channel: "same" },
  ];
  const audit = auditDefinitions(
    definitions,
    new Set(["appContracts.one"]),
  );
  assert.equal(audit.missing.length, 1);
  assert.equal(audit.missing[0].member, "two");
  assert.deepEqual(audit.duplicateChannels, [
    {
      channel: "same",
      contracts: ["appContracts.one", "appContracts.two"],
    },
  ]);
});

test("masks comments and strings while preserving code positions", () => {
  const source = `appContracts.real; // appContracts.fake\n"appContracts.string";`;
  const masked = maskCommentsAndStrings(source);
  assert.match(masked, /appContracts\.real/);
  assert.doesNotMatch(masked, /appContracts\.fake/);
  assert.doesNotMatch(masked, /appContracts\.string/);
  assert.equal(masked.length, source.length);
});
