import type { ProcessedNode, TextSegment } from "../types";

function cssColorToRN(color: string): string {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return `rgb(${r}, ${g}, ${b})`;
    }
    return color;
  }
  if (color.startsWith("rgba")) {
    return color;
  }
  return color;
}

function segmentToJSX(
  seg: TextSegment,
  isLast: boolean,
  styleName: string,
): string {
  const props: string[] = [];
  if (seg.fontFamily) props.push(`fontFamily: "${seg.fontFamily}"`);
  if (seg.fontSize) props.push(`fontSize: ${seg.fontSize}`);
  if (seg.fontWeight) props.push(`fontWeight: "${seg.fontWeight}"`);
  if (seg.fontStyle) props.push(`fontStyle: "${seg.fontStyle}"`);
  if (seg.textColor) props.push(`color: "${cssColorToRN(seg.textColor)}"`);
  if (seg.letterSpacing) props.push(`letterSpacing: ${seg.letterSpacing}`);
  if (seg.textDecoration && seg.textDecoration !== "none") {
    props.push(`textDecorationLine: "${seg.textDecoration}"`);
  }

  const chars = seg.characters
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$");

  if (props.length === 0) return `{\`${chars}\`}`;

  return `<Text key="${styleName}" style={styles.${styleName}}>{\`${chars}\`}</Text>`;
}

export function generateTextComponent(
  node: ProcessedNode,
  parentStyleName: string,
): { component: string; styles: string } {
  const baseName = `${parentStyleName}_${node.name.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const styleName = `${baseName}_text`;
  const textStyleName = `${baseName}_txt`;

  const textStyles: string[] = [];
  if (node.fontFamily) textStyles.push(`fontFamily: "${node.fontFamily}"`);
  if (node.fontSize) textStyles.push(`fontSize: ${node.fontSize}`);
  if (node.fontWeight) textStyles.push(`fontWeight: "${node.fontWeight}"`);
  if (node.fontStyle) textStyles.push(`fontStyle: "${node.fontStyle}"`);
  if (node.textColor)
    textStyles.push(`color: "${cssColorToRN(node.textColor)}"`);
  if (node.textAlign) textStyles.push(`textAlign: "${node.textAlign}"`);
  if (node.lineHeight) textStyles.push(`lineHeight: ${node.lineHeight}`);
  if (node.letterSpacing)
    textStyles.push(`letterSpacing: ${node.letterSpacing}`);
  if (node.textDecoration && node.textDecoration !== "none") {
    textStyles.push(`textDecorationLine: "${node.textDecoration}"`);
  }

  const styleDef =
    textStyles.length > 0
      ? `${textStyleName}: {${textStyles.join(", ")}},`
      : "";

  if (node.textSegments && node.textSegments.length > 1) {
    const segments = node.textSegments.map((seg, i) => {
      const segName = `${baseName}_seg_${i}`;
      return {
        component: segmentToJSX(
          seg,
          i === node.textSegments!.length - 1,
          segName,
        ),
        styleName: segName,
      };
    });

    const segStyles = node.textSegments
      .map((seg, i) => {
        const segName = `${baseName}_seg_${i}`;
        const segProps: string[] = [];
        if (seg.fontFamily) segProps.push(`fontFamily: "${seg.fontFamily}"`);
        if (seg.fontSize) segProps.push(`fontSize: ${seg.fontSize}`);
        if (seg.fontWeight) segProps.push(`fontWeight: "${seg.fontWeight}"`);
        if (seg.fontStyle) segProps.push(`fontStyle: "${seg.fontStyle}"`);
        if (seg.textColor)
          segProps.push(`color: "${cssColorToRN(seg.textColor)}"`);
        if (seg.letterSpacing)
          segProps.push(`letterSpacing: ${seg.letterSpacing}`);
        if (seg.textDecoration && seg.textDecoration !== "none") {
          segProps.push(`textDecorationLine: "${seg.textDecoration}"`);
        }
        return `${segName}: {${segProps.join(", ")}},`;
      })
      .join("\n    ");

    const segmentComponents = segments
      .map((s) => s.component)
      .join("\n          ");

    return {
      component: `<Text style={styles.${textStyleName}}>\n          ${segmentComponents}\n        </Text>`,
      styles: [styleDef, segStyles].filter(Boolean).join("\n    "),
    };
  }

  const text = (node.text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$");

  const component =
    text.length > 0
      ? `<Text style={styles.${textStyleName}}>{\`${text}\`}</Text>`
      : `<Text style={styles.${textStyleName}}></Text>`;

  return { component, styles: styleDef };
}
