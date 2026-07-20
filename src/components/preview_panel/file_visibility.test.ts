import { describe, expect, it } from "vitest";

import {
  getVisibleCaideSourceFiles,
  isVisibleCaideSourceFile,
} from "./file_visibility";

describe("CAIDE source file visibility", () => {
  it("hides runtime metadata, dependencies, and generated output", () => {
    expect(
      getVisibleCaideSourceFiles([
        ".dyad/chats/1.md",
        ".caide/runtime.json",
        "dist/assets/index.js",
        "node_modules/react/index.js",
        "coverage/index.html",
        "src/pages/Index.tsx",
        "package.json",
      ]),
    ).toEqual(["src/pages/Index.tsx", "package.json"]);
  });

  it("normalizes Windows paths before filtering", () => {
    expect(isVisibleCaideSourceFile("dist\\assets\\index.js")).toBe(false);
    expect(isVisibleCaideSourceFile("src\\App.tsx")).toBe(true);
  });
});
