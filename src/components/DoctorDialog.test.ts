import { describe, expect, it } from "vitest";

import { buildDoctorRepairPrompt } from "./DoctorDialog";

describe("buildDoctorRepairPrompt", () => {
  it("asks the agent to repair findings across the full application", () => {
    const prompt = buildDoctorRepairPrompt([
      {
        category: "responsive-layout",
        severity: "error",
        message: "The root is constrained",
        file: "src/App.tsx",
        line: 12,
      },
      {
        category: "security",
        severity: "warning",
        message: "Unsafe HTML needs review",
      },
    ]);

    expect(prompt).toContain("entire application");
    expect(prompt).toContain("Responsive layout in src/App.tsx:12");
    expect(prompt).toContain("Security: Unsafe HTML needs review");
    expect(prompt).toContain("all screens, routes, navigation flows");
    expect(prompt).toContain("app root must fill the CAIDE preview viewport");
    expect(prompt).toContain("Run the build and relevant checks");
  });
});
