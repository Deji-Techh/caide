import { describe, expect, it } from "vitest";

import {
  CAIDE_UI_QUALITY_CODE,
  scanMobileUiResponse,
  scanMobileUiSource,
} from "./mobile_ui_quality";

describe("mobile UI quality scanner", () => {
  it("rejects a fixed simulated phone inside the preview", () => {
    const issues = scanMobileUiSource(
      "src/pages/Index.tsx",
      `<main className="min-h-screen"><div className="max-w-[390px] h-[780px] rounded-[40px] border-8">{/* Main Phone Container / Phone Notch */}</div></main>`,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe(CAIDE_UI_QUALITY_CODE);
    expect(issues[0].message).toContain("Nested device shell");
  });

  it("rejects visible legacy branding", () => {
    const issues = scanMobileUiSource(
      "src/components/Brand.tsx",
      `<a href="https://www.dyad.sh/">Made with Dyad</a>`,
    );
    expect(issues.some((issue) => issue.message.includes("branding"))).toBe(
      true,
    );
  });

  it("accepts a responsive full-viewport app surface", () => {
    expect(
      scanMobileUiSource(
        "src/pages/Index.tsx",
        `<main className="min-h-[100dvh] w-full overflow-x-hidden"><section className="mx-auto w-full max-w-3xl p-4" /></main>`,
      ),
    ).toEqual([]);
  });

  it("scans only the latest write for a file", () => {
    const issues = scanMobileUiResponse(`
      <dyad-write path="src/App.tsx"><div>Made with Dyad</div></dyad-write>
      <dyad-write path="src/App.tsx"><main className="min-h-[100dvh] w-full" /></dyad-write>
    `);
    expect(issues).toEqual([]);
  });
});
