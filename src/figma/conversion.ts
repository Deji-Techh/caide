import type {
  FigmaJsonNode,
  ProcessedNode,
  TextSegment,
} from "./types";
import { figmaColorToCss, parseFigmaEffects } from "./color";
import {
  calculateRectFromBoundingBox,
  justifyContentMap,
  alignItemsMap,
  layoutModeToFlexDirection,
} from "./position";

function collectTextSegments(node: FigmaJsonNode): TextSegment[] | undefined {
  if (!node.style?.fills || node.style.fills.length === 0) return undefined;

  const primaryFill = node.style.fills.find(
    (f) => f.type === "SOLID" && f.visible !== false,
  );
  const textColor = figmaColorToCss(
    primaryFill?.color,
    primaryFill?.opacity,
  );

  const segment: TextSegment = {
    characters: node.characters ?? "",
    fontFamily: node.style?.fontFamily,
    fontSize: node.style?.fontSize,
    fontWeight: node.style?.fontWeight,
    textColor,
    letterSpacing: node.style?.letterSpacing,
    textDecoration: node.style?.textDecoration === "UNDERLINE"
      ? "underline"
      : node.style?.textDecoration === "STRIKETHROUGH"
        ? "line-through"
        : undefined,
  };

  // Handle styled text segments via styleOverrideTable
  if (node.characterStyleOverrides && node.styleOverrideTable && node.characters) {
    const overrides = node.characterStyleOverrides;
    const table = node.styleOverrideTable;
    const segments: TextSegment[] = [];
    let currentStart = 0;
    let currentOverrideId = overrides[0] ?? 0;

    for (let i = 0; i <= overrides.length; i++) {
      const overrideId = overrides[i] ?? 0;
      if (overrideId !== currentOverrideId) {
        const chars = node.characters.slice(currentStart, i);
        if (currentOverrideId && table[currentOverrideId]) {
          const s = table[currentOverrideId];
          const segFill = s.fills?.find(
            (f: any) => f.type === "SOLID" && f.visible !== false,
          );
          segments.push({
            characters: chars,
            fontFamily: s.fontFamily ?? segment.fontFamily,
            fontSize: s.fontSize ?? segment.fontSize,
            fontWeight: s.fontWeight ?? segment.fontWeight,
            textColor: segFill
              ? figmaColorToCss(segFill.color, segFill.opacity)
              : textColor,
          });
        } else {
          const { characters: _oldChars, ...segmentRest } = segment;
          segments.push({ characters: chars, ...segmentRest });
        }
        currentStart = i;
        currentOverrideId = overrideId;
      }
    }

    if (segments.length > 1) return segments;
  }

  return undefined;
}

function processFill(
  fills?: FigmaJsonNode["fills"],
): { solid?: string; image?: string } | undefined {
  if (!fills) return undefined;
  const solidFill = fills.find(
    (f) => f.type === "SOLID" && f.visible !== false,
  );
  if (solidFill?.color) {
    const color = figmaColorToCss(solidFill.color, solidFill.opacity);
    if (color) return { solid: color };
  }

  const imageFill = fills.find(
    (f) => f.type === "IMAGE" && f.visible !== false,
  );
  if (imageFill?.imageRef) {
    return { image: imageFill.imageRef };
  }

  return undefined;
}

function processStrokes(
  strokes?: FigmaJsonNode["strokes"],
  strokeWeight?: number,
  individualStrokeWeights?: FigmaJsonNode["individualStrokeWeights"],
): { color?: string; width?: number | { top: number; right: number; bottom: number; left: number } } | undefined {
  if (!strokes) return undefined;
  const solidStroke = strokes.find(
    (s) => s.type === "SOLID" && s.visible !== false,
  );
  if (!solidStroke) return undefined;

  const color = figmaColorToCss(solidStroke.color, solidStroke.opacity);
  if (!color) return undefined;

  let width: number | { top: number; right: number; bottom: number; left: number } | undefined;
  if (individualStrokeWeights) {
    width = {
      top: individualStrokeWeights.top,
      right: individualStrokeWeights.right,
      bottom: individualStrokeWeights.bottom,
      left: individualStrokeWeights.left,
    };
  } else if (strokeWeight && strokeWeight > 0) {
    width = strokeWeight;
  }

  if (!width) return undefined;

  return { color, width };
}

function getCornerRadius(
  cornerRadius?: number,
  rectangleCornerRadii?: [number, number, number, number],
): number | [number, number, number, number] | undefined {
  if (rectangleCornerRadii) {
    const [tl, tr, br, bl] = rectangleCornerRadii;
    if (tl === tr && tr === br && br === bl) {
      return tl;
    }
    return rectangleCornerRadii;
  }
  return cornerRadius;
}

function shouldBeAbsolute(
  node: FigmaJsonNode,
  parent?: ProcessedNode,
): boolean {
  if (node.layoutPositioning === "ABSOLUTE") return true;
  if (!parent) return false;
  if (parent.layoutMode === "none" || !parent.layoutMode) return true;
  return false;
}

function getFontStyle(
  style?: FigmaJsonNode["style"],
): "normal" | "italic" | undefined {
  if (!style?.fontPostScriptName) return undefined;
  return style.fontPostScriptName.toLowerCase().includes("italic")
    ? "italic"
    : "normal";
}

export function processFigmaNode(
  node: FigmaJsonNode,
  parent?: ProcessedNode,
): ProcessedNode | null {
  if (node.visible === false) return null;
  if (node.type === "SLICE") return null;

  const bbox = node.absoluteBoundingBox;
  if (!bbox) return null;

  const parentBbox = parent
    ? { x: 0, y: 0, width: parent.width, height: parent.height }
    : bbox;

  const rect = calculateRectFromBoundingBox(
    {
      width: bbox.width,
      height: bbox.height,
      x: bbox.x - (parent ? (parent.x ?? 0) : 0),
      y: bbox.y - (parent ? (parent.y ?? 0) : 0),
    },
    -(node.rotation ?? 0) * (180 / Math.PI),
  );

  const fill = processFill(node.fills);
  const stroke = processStrokes(
    node.strokes,
    node.strokeWeight,
    node.individualStrokeWeights,
  );
  const shadows = parseFigmaEffects(node.effects);
  const borderRadius = getCornerRadius(
    node.cornerRadius,
    node.rectangleCornerRadii,
  );
  const isText = node.type === "TEXT";
  const textSegments = isText ? collectTextSegments(node) : undefined;

  const isAbsolute =
    node.layoutPositioning === "ABSOLUTE" ||
    (parent?.layoutMode && parent.layoutMode !== "none"
      ? false
      : node.layoutPositioning !== "AUTO");

  const processed: ProcessedNode = {
    id: node.id,
    name: node.name,
    type: isText ? "text" : node.type === "RECTANGLE" || node.type === "ELLIPSE" || node.type === "FRAME" || node.type === "INSTANCE" || node.type === "COMPONENT" || node.type === "COMPONENT_SET"
      ? "view"
      : node.type === "VECTOR" || node.type === "BOOLEAN_OPERATION"
        ? "vector"
        : "view",
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    rotation: rect.rotation !== 0 ? rect.rotation : undefined,
    opacity: node.opacity ?? 1,
    visible: true,
    backgroundColor: fill?.solid,
    backgroundImage: fill?.image,
    borderRadius,
    borderWidth: stroke?.width,
    borderColor: stroke?.color,
    shadows,
    text: node.characters,
    fontFamily: node.style?.fontFamily,
    fontSize: node.style?.fontSize,
    fontWeight: node.style?.fontWeight,
    fontStyle: getFontStyle(node.style),
    textAlign: node.style?.textAlignHorizontal
      ? (node.style.textAlignHorizontal.toLowerCase() as "left" | "center" | "right")
      : undefined,
    textColor: textSegments?.[0]?.textColor,
    lineHeight: node.style?.lineHeightPx,
    letterSpacing: node.style?.letterSpacing,
    textDecoration: node.style?.textDecoration === "UNDERLINE"
      ? "underline"
      : node.style?.textDecoration === "STRIKETHROUGH"
        ? "line-through"
        : undefined,
    textSegments,
    layoutMode: node.layoutMode === "HORIZONTAL" ? "horizontal" : node.layoutMode === "VERTICAL" ? "vertical" : "none",
    paddingTop: node.paddingTop ?? 0,
    paddingRight: node.paddingRight ?? 0,
    paddingBottom: node.paddingBottom ?? 0,
    paddingLeft: node.paddingLeft ?? 0,
    itemSpacing: node.itemSpacing ?? 0,
    justifyContent: node.primaryAxisAlignItems
      ? justifyContentMap[node.primaryAxisAlignItems]
      : undefined,
    alignItems: node.counterAxisAlignItems
      ? alignItemsMap[node.counterAxisAlignItems]
      : undefined,
    flexGrow: node.layoutGrow ?? 0,
    isAbsolute,
    clipsContent: node.clipsContent,
    children: [],
  };

  if (node.children) {
    for (const child of node.children) {
      const processedChild = processFigmaNode(child, processed);
      if (processedChild) {
        processed.children.push(processedChild);
      }
    }
  }

  return processed;
}

export function flattenTopFrames(
  doc: FigmaJsonNode,
): FigmaJsonNode[] {
  const frames: FigmaJsonNode[] = [];

  function walk(node: FigmaJsonNode) {
    if (
      node.type === "FRAME" ||
      node.type === "COMPONENT" ||
      node.type === "COMPONENT_SET" ||
      node.type === "INSTANCE"
    ) {
      frames.push(node);
    }
    if (node.children) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  if (doc.children) {
    for (const child of doc.children) {
      walk(child);
    }
  }

  return frames;
}

export function getFrameThumbnailInfo(
  node: FigmaJsonNode,
): { id: string; name: string; width: number; height: number } | null {
  const bbox = node.absoluteBoundingBox;
  if (!bbox) return null;
  return {
    id: node.id,
    name: node.name,
    width: Math.round(bbox.width),
    height: Math.round(bbox.height),
  };
}
