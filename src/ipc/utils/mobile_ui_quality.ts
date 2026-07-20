import * as path from "node:path";
import * as fs from "node:fs/promises";

import type { Problem } from "@/ipc/types";
import { getDyadWriteTags } from "./dyad_tag_parser";

export const CAIDE_UI_QUALITY_CODE = 9001;

const UI_SOURCE_EXTENSION = /\.(?:css|html|jsx|tsx|js|ts)$/i;
const LEGACY_BRANDING = /made\s+with\s+dyad|https?:\/\/(?:www\.)?dyad\.sh/i;
const DEVICE_LANGUAGE =
  /(?:main\s+)?phone\s+(?:container|frame|shell|mockup)|device\s+(?:frame|shell|mockup)|phone\s+notch|status\s+bar|home\s+indicator|camera\s+cutout/i;
const FIXED_PHONE_WIDTH =
  /(?:max-)?w-\[(?:3[2-9]\d|4[0-3]\d)px\]|(?:max-)?width\s*:\s*(?:3[2-9]\d|4[0-3]\d)px/i;
const FIXED_PHONE_HEIGHT =
  /h-\[(?:6\d\d|7\d\d|8\d\d|9\d\d|1\d{3})px\]|height\s*:\s*(?:6\d\d|7\d\d|8\d\d|9\d\d|1\d{3})px/i;
const WIDE_MIN_WIDTH =
  /min-w-\[(?:4[4-9]\d|[5-9]\d\d|\d{4,})px\]|min-width\s*:\s*(?:4[4-9]\d|[5-9]\d\d|\d{4,})px/i;
const HORIZONTAL_PAGE_SCROLL =
  /(?:overflow-x-(?:auto|scroll)|overflow-x\s*:\s*(?:auto|scroll))/i;

const lineDetails = (content: string, index: number) => {
  const safeIndex = Math.max(0, index);
  const before = content.slice(0, safeIndex);
  const line = before.split("\n").length;
  const lineStart = before.lastIndexOf("\n") + 1;
  const lineEnd = content.indexOf("\n", safeIndex);
  return {
    line,
    column: safeIndex - lineStart + 1,
    snippet: content
      .slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
      .trim(),
  };
};

const problem = (
  file: string,
  content: string,
  index: number,
  message: string,
): Problem => ({
  file,
  ...lineDetails(content, index),
  message,
  code: CAIDE_UI_QUALITY_CODE,
});

export function scanMobileUiSource(file: string, content: string): Problem[] {
  if (!UI_SOURCE_EXTENSION.test(file)) return [];

  const issues: Problem[] = [];
  const branding = content.search(LEGACY_BRANDING);
  if (branding >= 0) {
    issues.push(
      problem(
        file,
        content,
        branding,
        "CAIDE branding violation: remove visible Dyad attribution, links, and badges from the generated application.",
      ),
    );
  }

  const deviceLanguage = content.search(DEVICE_LANGUAGE);
  const fixedWidth = content.search(FIXED_PHONE_WIDTH);
  const fixedHeight = content.search(FIXED_PHONE_HEIGHT);
  if (deviceLanguage >= 0 && (fixedWidth >= 0 || fixedHeight >= 0)) {
    issues.push(
      problem(
        file,
        content,
        deviceLanguage,
        "Nested device shell: CAIDE supplies the device frame. Remove simulated phone chrome and make the app root fill the real preview viewport.",
      ),
    );
  } else if (fixedHeight >= 0 && /min-h-screen|100d?vh/i.test(content)) {
    issues.push(
      problem(
        file,
        content,
        fixedHeight,
        "Fixed phone-height canvas: replace the fixed screen height with fluid min-height: 100dvh layout and responsive content constraints.",
      ),
    );
  }

  const wideMinWidth = content.search(WIDE_MIN_WIDTH);
  if (wideMinWidth >= 0) {
    issues.push(
      problem(
        file,
        content,
        wideMinWidth,
        "Mobile overflow risk: remove the desktop-sized minimum width and allow the layout to shrink to compact phone widths.",
      ),
    );
  }

  const horizontalScroll = content.search(HORIZONTAL_PAGE_SCROLL);
  if (
    horizontalScroll >= 0 &&
    /body|main|min-h-screen|100d?vh/i.test(content)
  ) {
    issues.push(
      problem(
        file,
        content,
        horizontalScroll,
        "Horizontal page scrolling is not allowed in generated mobile screens. Reflow the content responsively instead.",
      ),
    );
  }

  return issues;
}

export function scanMobileUiResponse(fullResponse: string): Problem[] {
  const latestByPath = new Map<string, string>();
  for (const write of getDyadWriteTags(fullResponse)) {
    latestByPath.set(write.path, write.content);
  }
  return [...latestByPath].flatMap(([file, content]) =>
    scanMobileUiSource(file, content),
  );
}

export async function scanMobileUiFiles(
  appPath: string,
  files: readonly string[],
): Promise<Problem[]> {
  const uniqueFiles = [...new Set(files)].filter((file) =>
    UI_SOURCE_EXTENSION.test(file),
  );
  const results = await Promise.all(
    uniqueFiles.map(async (file) => {
      try {
        const content = await fs.readFile(path.join(appPath, file), "utf8");
        return scanMobileUiSource(file, content);
      } catch {
        return [];
      }
    }),
  );
  return results.flat();
}

export function createMobileUiQualityPrompt(problems: readonly Problem[]) {
  const details = problems
    .map(
      (item, index) =>
        `${index + 1}. ${item.file}:${item.line}:${item.column} - ${item.message}`,
    )
    .join("\n");
  return `[System] CAIDE's mobile UI quality gate rejected the current result:\n${details}\n\nRepair every issue now. The selected CAIDE device frame is the only device chrome. Use responsive full-viewport app content, then verify the affected files before finalizing.`;
}
