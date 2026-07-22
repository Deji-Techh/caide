import type { ProcessedNode } from "../types";
import { generateTextComponent } from "./text";

interface GeneratedCode {
  component: string;
  styles: string;
}

function styleValue(v: unknown): string {
  if (typeof v === "string") return `"${v}"`;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return String(v);
  return String(v);
}

function borderRadiusToRN(
  br: number | [number, number, number, number] | undefined,
): Record<string, number> | number | undefined {
  if (br === undefined) return undefined;
  if (typeof br === "number") return br;
  if (Array.isArray(br)) {
    const [tl, tr, brc, bl] = br;
    if (tl === tr && tr === brc && brc === bl) return tl;
    return {
      borderTopLeftRadius: tl,
      borderTopRightRadius: tr,
      borderBottomRightRadius: brc,
      borderBottomLeftRadius: bl,
    };
  }
  return undefined;
}

function borderWidthToRN(
  bw: number | { top: number; right: number; bottom: number; left: number } | undefined,
): Record<string, number> | number | undefined {
  if (bw === undefined) return undefined;
  if (typeof bw === "number") return bw;
  return {
    borderTopWidth: bw.top,
    borderRightWidth: bw.right,
    borderBottomWidth: bw.bottom,
    borderLeftWidth: bw.left,
  };
}

function generateViewStyle(
  node: ProcessedNode,
  styleName: string,
): string {
  const props: string[] = [];

  if (node.rotation) {
    props.push(`transform: [{ rotate: "${node.rotation}deg" }]`);
  }

  if (node.opacity < 1) {
    props.push(`opacity: ${styleValue(node.opacity)}`);
  }

  if (node.isAbsolute || (node.x !== 0 || node.y !== 0)) {
    if (node.isAbsolute) props.push("position: \"absolute\"");
    if (node.x !== 0) props.push(`left: ${node.x}`);
    if (node.y !== 0) props.push(`top: ${node.y}`);
  }

  if (node.width > 0) props.push(`width: ${node.width}`);
  if (node.height > 0) props.push(`height: ${node.height}`);

  if (node.backgroundColor) {
    const color = node.backgroundColor.startsWith("#")
      ? node.backgroundColor
      : node.backgroundColor;
    props.push(`backgroundColor: "${color}"`);
  }

  const br = borderRadiusToRN(node.borderRadius);
  if (typeof br === "number") {
    props.push(`borderRadius: ${br}`);
  } else if (br) {
    for (const [k, v] of Object.entries(br)) {
      props.push(`${k}: ${v}`);
    }
  }

  if (node.borderColor) {
    props.push(`borderColor: "${node.borderColor}"`);
  }

  const bw = borderWidthToRN(node.borderWidth);
  if (typeof bw === "number") {
    props.push(`borderWidth: ${bw}`);
  } else if (bw) {
    for (const [k, v] of Object.entries(bw)) {
      props.push(`${k}: ${v}`);
    }
  }

  if (node.shadows && node.shadows.length > 0) {
    const shadow = node.shadows[0];
    props.push(`shadowColor: "${shadow.color}"`);
    props.push(`shadowOffset: { width: ${shadow.offsetX}, height: ${shadow.offsetY} }`);
    props.push(`shadowOpacity: 1`);
    props.push(`shadowRadius: ${shadow.blur}`);
    props.push(`elevation: ${Math.min(shadow.blur, 10)}`);
  }

  if (node.clipsContent) {
    props.push("overflow: \"hidden\"");
  }

  // Auto-layout (flexbox)
  if (node.layoutMode && node.layoutMode !== "none") {
    props.push(`flexDirection: "${node.layoutMode}"`);
    if (node.justifyContent) props.push(`justifyContent: "${node.justifyContent}"`);
    if (node.alignItems) props.push(`alignItems: "${node.alignItems}"`);
    if (node.paddingTop !== 0 || node.paddingRight !== 0 || node.paddingBottom !== 0 || node.paddingLeft !== 0) {
      props.push(`paddingTop: ${node.paddingTop}`);
      props.push(`paddingRight: ${node.paddingRight}`);
      props.push(`paddingBottom: ${node.paddingBottom}`);
      props.push(`paddingLeft: ${node.paddingLeft}`);
    }
    if (node.itemSpacing !== 0) {
      props.push(node.layoutMode === "horizontal" ? `columnGap: ${node.itemSpacing}` : `rowGap: ${node.itemSpacing}`);
    }
  }

  if (node.flexGrow > 0) {
    props.push(`flex: ${node.flexGrow}`);
  }

  if (props.length === 0) return "";
  return `${styleName}: { ${props.join(", ") } },`;
}

function generateNodeComponent(
  node: ProcessedNode,
  parentStyleName: string,
  depth: number,
): { component: string; styles: string } {
  const indent = "  ".repeat(depth + 1);
  const styleIndent = "  ".repeat(depth + 1);
  const baseName = `${parentStyleName}_${node.name.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const viewStyleName = `${baseName}_view`;

  let component = "";
  let styles = "";

  if (node.type === "text") {
    const textResult = generateTextComponent(node, parentStyleName);
    const viewStyle = generateViewStyle(node, viewStyleName);
    styles = [viewStyle, textResult.styles].filter(Boolean).join("\n    ");

    if (viewStyle) {
      component = `${indent}<View style={styles.${viewStyleName}}>\n${indent}  ${textResult.component}\n${indent}</View>`;
    } else {
      component = `${indent}${textResult.component}`;
    }
  } else if (node.type === "vector") {
    const viewStyle = generateViewStyle(node, viewStyleName);

    if (node.backgroundColor) {
      styles = viewStyle;
      component = `${indent}<View style={styles.${viewStyleName}} />`;
    } else {
      styles = viewStyle;
      component = `${indent}<View style={styles.${viewStyleName}} />`;
    }
  } else {
    const viewStyle = generateViewStyle(node, viewStyleName);
    styles = viewStyle;

    if (node.children.length > 0) {
      const childrenResults = node.children.map((child) =>
        generateNodeComponent(child, baseName, depth + 1),
      );

      const childComponents = childrenResults
        .map((r) => r.component)
        .join("\n");
      const childStyles = childrenResults
        .map((r) => r.styles)
        .filter(Boolean)
        .join("\n    ");

      styles = [viewStyle, childStyles].filter(Boolean).join("\n    ");

      if (node.children.length <= 3) {
        component = `${indent}<View style={styles.${viewStyleName}}>\n${childComponents}\n${indent}</View>`;
      } else {
        const childComponentList = childrenResults
          .map((r) => r.component)
          .join(`\n${indent}  `);
        component = `${indent}<View style={styles.${viewStyleName}}>\n${indent}  ${childComponentList}\n${indent}</View>`;
      }
    } else {
      component = `${indent}<View style={styles.${viewStyleName}} />`;
    }
  }

  return { component, styles };
}

export function generateRNCode(
  nodes: ProcessedNode[],
): string {
  if (nodes.length === 0) return "";

  let allComponents = "";
  let allStyles = "";

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const rootName = `Root${i}`;
    const result = generateNodeComponent(node, rootName, 1);
    allComponents += result.component;
    if (i < nodes.length - 1) allComponents += "\n";
    allStyles += result.styles;
  }

  const imports = `import React from "react";
import { View, Text, StyleSheet } from "react-native";`;

  const componentCode = `export default function FigmaScreen() {
  return (
    <View style={styles.container}>
      {${nodes.length > 1 ? "<>" : ""}
        ${allComponents}
      ${nodes.length > 1 ? "</>" : ""}
    </View>
  );
}`;

  const fullStyles = `const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  ${allStyles}
});`;

  return `${imports}\n\n${componentCode}\n\n${fullStyles}`;
}

export function generateLayoutSpec(
  nodes: ProcessedNode[],
): string {
  return JSON.stringify(nodes, null, 2);
}
