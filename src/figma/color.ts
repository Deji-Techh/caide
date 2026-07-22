export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(Math.max(0, Math.min(1, n)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase();
}

export function rgbToRgba(r: number, g: number, b: number, a: number): string {
  const round = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 255);
  return `rgba(${round(r)}, ${round(g)}, ${round(b)}, ${a.toFixed(2)})`;
}

export function figmaColorToCss(
  color?: { r: number; g: number; b: number; a?: number },
  opacity?: number,
): string | undefined {
  if (!color) return undefined;
  const alpha = (color.a ?? 1) * (opacity ?? 1);

  if (alpha === 1) {
    if (color.r === 1 && color.g === 1 && color.b === 1) return "#ffffff";
    if (color.r === 0 && color.g === 0 && color.b === 0) return "#000000";
    return rgbToHex(color.r, color.g, color.b);
  }

  return rgbToRgba(color.r, color.g, color.b, alpha);
}

export function parseFigmaEffects(
  effects?: Array<{
    type: string;
    visible?: boolean;
    color?: { r: number; g: number; b: number; a: number };
    offset?: { x: number; y: number };
    radius: number;
    spread?: number;
  }>,
):
  | Array<{
      color: string;
      offsetX: number;
      offsetY: number;
      blur: number;
      spread: number;
    }>
  | undefined {
  if (!effects) return undefined;
  const shadows = effects.filter(
    (e) =>
      e.visible !== false &&
      (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW"),
  );
  if (shadows.length === 0) return undefined;

  return shadows.map((s) => ({
    color: figmaColorToCss(s.color, s.color?.a) ?? "#00000040",
    offsetX: s.offset?.x ?? 0,
    offsetY: s.offset?.y ?? 0,
    blur: s.radius,
    spread: s.spread ?? 0,
  }));
}
