const FIGMA_FILE_URL_REGEX =
  /figma\.com\/(file|proto)\/([a-zA-Z0-9]{12,})(?:\/.*)?$/;

const FIGMA_NODE_ID_REGEX = /[?&]node-id=([a-zA-Z0-9_-]+)/;

export function parseFigmaUrl(url: string): {
  fileKey: string;
  nodeIds?: string[];
} | null {
  const fileMatch = url.match(FIGMA_FILE_URL_REGEX);
  if (!fileMatch) return null;

  const fileKey = fileMatch[2];
  const nodeMatch = url.match(FIGMA_NODE_ID_REGEX);
  let nodeIds: string[] | undefined;

  if (nodeMatch) {
    nodeIds = nodeMatch[1].split(",").map((id) => id.trim());
  }

  return { fileKey, nodeIds };
}

export function figmaFileUrl(fileKey: string): string {
  return `https://www.figma.com/file/${fileKey}`;
}
