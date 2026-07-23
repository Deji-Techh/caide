import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("builder renderer symbol regressions", () => {
  it("imports the Users icon used by the Collaborate button", () => {
    const source = readSource("src/pages/chat.tsx");

    expect(source).toMatch(
      /import\s*\{[\s\S]*?\bUsers\b[\s\S]*?\}\s*from\s*["']lucide-react["']/,
    );
    expect(source).toContain("<Users size={14} /> Collaborate");
  });

  it("returns the QR popover aliases from declared hook state", () => {
    const source = readSource("src/hooks/useMobilePreview.ts");

    expect(source).toContain(
      "const [isPopoverOpen, setIsPopoverOpen] = useState(false);",
    );
    expect(source).toContain("isQrPopoverOpen: isPopoverOpen");
    expect(source).toContain("setIsQrPopoverOpen: setIsPopoverOpen");
    expect(source).not.toMatch(/^\s*isQrPopoverOpen,\s*$/m);
    expect(source).not.toMatch(/^\s*setIsQrPopoverOpen,\s*$/m);
  });
});
