// Matches all Figma URL formats (design, file, board, proto, slides, deck, etc.)
// https://developers.figma.com/docs/embeds/resources/
const FIGMA_URL_REGEX =
  /https:\/\/[\w.-]+\.figma\.com\/([\w-]+)\/([0-9a-zA-Z]{22,128})(?:\/[^?#]*)?(?:\?[^#]*)?$/;

const FIGMA_NODE_ID_REGEX = /[?&]node-id=([a-zA-Z0-9_:,-]+)/;

export function parseFigmaUrl(url: string): {
  fileKey: string;
  nodeIds?: string[];
} | null {
  const trimmed = url.trim();
  const fileMatch = trimmed.match(FIGMA_URL_REGEX);
  if (!fileMatch) return null;

  const fileKey = fileMatch[2];
  const nodeMatch = trimmed.match(FIGMA_NODE_ID_REGEX);
  let nodeIds: string[] | undefined;

  if (nodeMatch) {
    nodeIds = nodeMatch[1].split(",").map((id) => id.replace(":", "-").trim());
  }

  return { fileKey, nodeIds };
}

export function figmaFileUrl(fileKey: string): string {
  return `https://www.figma.com/design/${fileKey}`;
}
