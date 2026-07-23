import { describe, expect, it } from "vitest";

import {
  compareVersionNames,
  escapeDistinguishedNameValue,
  inferArtifactKind,
  parseCapacitorConfigText,
  sanitizeArtifactName,
} from "./native_release_helpers";

describe("native release helpers", () => {
  it("reads JSON and TypeScript Capacitor configs", () => {
    expect(
      parseCapacitorConfigText(
        JSON.stringify({
          appId: "com.caide.demo",
          appName: "CAIDE Demo",
          webDir: "dist",
        }),
        ".json",
      ),
    ).toEqual({
      appId: "com.caide.demo",
      appName: "CAIDE Demo",
      webDir: "dist",
    });

    expect(
      parseCapacitorConfigText(
        `export default { appId: 'com.caide.app', appName: "App", webDir: 'build' }`,
        ".ts",
      ),
    ).toEqual({
      appId: "com.caide.app",
      appName: "App",
      webDir: "build",
    });
  });

  it("sorts Android SDK version directories numerically", () => {
    expect(compareVersionNames("35.0.0", "34.0.10")).toBeGreaterThan(0);
    expect(compareVersionNames("34.0.10", "34.0.2")).toBeGreaterThan(0);
  });

  it("creates stable artifact names", () => {
    expect(sanitizeArtifactName("My Great App 1.0")).toBe("my-great-app-1.0");
    expect(sanitizeArtifactName("***")).toBe("caide-app");
  });

  it("infers artifact types", () => {
    expect(inferArtifactKind("app-debug.apk")).toBe("debug-apk");
    expect(inferArtifactKind("app-release.apk")).toBe("release-apk");
    expect(inferArtifactKind("app-release.aab")).toBe("release-aab");
    expect(inferArtifactKind("App.ipa")).toBe("ipa");
    expect(inferArtifactKind("notes.txt")).toBeNull();
  });

  it("escapes distinguished-name values", () => {
    expect(escapeDistinguishedNameValue('CAIDE, Inc.')).toBe("CAIDE\\, Inc.");
  });
});
