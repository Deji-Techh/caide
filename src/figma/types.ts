export interface FigmaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaColorStop {
  position: number;
  color: { r: number; g: number; b: number; a: number };
}

export interface FigmaPaint {
  type: string;
  color?: { r: number; g: number; b: number; a?: number };
  opacity?: number;
  visible?: boolean;
  blendMode?: string;
  gradientStops?: FigmaColorStop[];
  gradientHandlePositions?: Array<{ x: number; y: number }>;
  scale?: number;
  imageTransform?: number[][];
  imageRef?: string;
  filters?: { type: string };
}

export interface FigmaEffect {
  type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
  visible?: boolean;
  color?: { r: number; g: number; b: number; a: number };
  offset?: { x: number; y: number };
  radius: number;
  spread?: number;
}

export interface FigmaTypeStyle {
  fontFamily?: string;
  fontPostScriptName?: string;
  fontWeight?: number;
  fontSize?: number;
  textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  textAlignVertical?: "TOP" | "CENTER" | "BOTTOM";
  letterSpacing?: number;
  lineHeightPx?: number;
  lineHeightPercent?: number;
  lineHeightUnit?: string;
  textCase?: "UPPER" | "LOWER" | "TITLE" | "ORIGINAL";
  textDecoration?: "UNDERLINE" | "STRIKETHROUGH" | "NONE";
  textAutoResize?: "NONE" | "WIDTH_AND_HEIGHT" | "HEIGHT" | "TRUNCATE";
  fills?: FigmaPaint[];
}

export interface FigmaJsonNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  locked?: boolean;
  rotation?: number;
  opacity?: number;
  blendMode?: string;
  absoluteBoundingBox?: FigmaRect;
  absoluteRenderBounds?: FigmaRect;
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  strokeWeight?: number;
  strokeAlign?: "INSIDE" | "OUTSIDE" | "CENTER";
  individualStrokeWeights?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  strokeJoin?: "MITER" | "BEVEL" | "ROUND";
  strokeMiterLimit?: number;
  strokeCap?: "ROUND" | "SQUARE" | "ARROW_LINES" | "NONE";
  effects?: FigmaEffect[];
  cornerRadius?: number;
  rectangleCornerRadii?: [number, number, number, number];
  cornerSmoothing?: number;
  children?: FigmaJsonNode[];
  layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL";
  layoutSizingHorizontal?: "FIXED" | "HUG" | "FILL";
  layoutSizingVertical?: "FIXED" | "HUG" | "FILL";
  layoutGrow?: number;
  layoutPositioning?: "AUTO" | "ABSOLUTE";
  primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "BASELINE";
  primaryAxisSizingMode?: "FIXED" | "AUTO";
  counterAxisSizingMode?: "FIXED" | "AUTO";
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  itemReverseZIndex?: boolean;
  overflowDirection?: string;
  clipsContent?: boolean;
  characters?: string;
  style?: FigmaTypeStyle;
  characterStyleOverrides?: number[];
  styleOverrideTable?: Record<string, FigmaTypeStyle>;
  textAutoResize?: "NONE" | "WIDTH_AND_HEIGHT" | "HEIGHT" | "TRUNCATION";
}

export interface ProcessedNode {
  id: string;
  name: string;
  type: "view" | "text" | "image" | "vector";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity: number;
  visible: boolean;
  backgroundColor?: string;
  backgroundImage?: string;
  borderRadius?: number | [number, number, number, number];
  borderWidth?: number | { top: number; right: number; bottom: number; left: number };
  borderColor?: string;
  shadows?: Array<{
    color: string;
    offsetX: number;
    offsetY: number;
    blur: number;
    spread: number;
  }>;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  textColor?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textDecoration?: "none" | "underline" | "line-through";
  textSegments?: TextSegment[];
  layoutMode?: "none" | "horizontal" | "vertical";
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  itemSpacing: number;
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
  flexGrow: number;
  isAbsolute: boolean;
  clipsContent?: boolean;
  children: ProcessedNode[];
}

export interface TextSegment {
  characters: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  textColor?: string;
  textDecoration?: "none" | "underline" | "line-through";
  letterSpacing?: number;
}
