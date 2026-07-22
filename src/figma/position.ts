interface BoundingBox {
  width: number;
  height: number;
  x: number;
  y: number;
}

interface RectResult {
  width: number;
  height: number;
  left: number;
  top: number;
  rotation: number;
}

export function calculateRectFromBoundingBox(
  bbox: BoundingBox,
  rotationDegrees: number,
): RectResult {
  const cssRotation = -rotationDegrees;
  const theta = (cssRotation * Math.PI) / 180;
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const absCos = Math.abs(cosTheta);
  const absSin = Math.abs(sinTheta);

  const { width: w_b, height: h_b, x: x_b, y: y_b } = bbox;

  const denom = absCos * absCos - absSin * absSin;
  if (Math.abs(denom) < 0.0001) {
    return {
      width: w_b,
      height: h_b,
      left: x_b,
      top: y_b,
      rotation: cssRotation,
    };
  }

  const h = (w_b * absSin - h_b * absCos) / -denom;
  const w = (w_b - h * absSin) / absCos;

  const corners = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];

  const rotated = corners.map(({ x, y }) => ({
    x: x * cosTheta + y * sinTheta,
    y: -x * sinTheta + y * cosTheta,
  }));

  const minX = Math.min(...rotated.map((c) => c.x));
  const minY = Math.min(...rotated.map((c) => c.y));

  return {
    width: Math.round(w * 100) / 100,
    height: Math.round(h * 100) / 100,
    left: Math.round((x_b - minX) * 100) / 100,
    top: Math.round((y_b - minY) * 100) / 100,
    rotation: cssRotation,
  };
}

export const justifyContentMap: Record<
  string,
  "flex-start" | "center" | "flex-end" | "space-between"
> = {
  MIN: "flex-start",
  CENTER: "center",
  MAX: "flex-end",
  SPACE_BETWEEN: "space-between",
};

export const alignItemsMap: Record<
  string,
  "flex-start" | "center" | "flex-end" | "stretch"
> = {
  MIN: "flex-start",
  CENTER: "center",
  MAX: "flex-end",
  BASELINE: "stretch",
};

export type FlexDirection = "row" | "column";

export function layoutModeToFlexDirection(
  layoutMode?: string,
): FlexDirection | undefined {
  if (layoutMode === "HORIZONTAL") return "row";
  if (layoutMode === "VERTICAL") return "column";
  return undefined;
}
