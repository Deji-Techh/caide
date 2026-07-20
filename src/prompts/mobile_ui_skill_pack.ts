import uiUxMasterySkill from "./skills/ui-ux-mastery/SKILL.md?raw";

import productArchetypes from "./skills/ui-ux-mastery/references/product-archetypes.md?raw";
import designSystem from "./skills/ui-ux-mastery/references/design-system.md?raw";
import componentContracts from "./skills/ui-ux-mastery/references/component-contracts.md?raw";
import accessibility from "./skills/ui-ux-mastery/references/accessibility.md?raw";
import antiSlop from "./skills/ui-ux-mastery/references/anti-slop.md?raw";
import designToCode from "./skills/ui-ux-mastery/references/design-to-code.md?raw";
import platformPatterns from "./skills/ui-ux-mastery/references/platform-patterns.md?raw";
import qualityRubric from "./skills/ui-ux-mastery/references/quality-rubric.md?raw";

import screenSpec from "./skills/ui-ux-mastery/templates/screen-spec.md?raw";
import componentContract from "./skills/ui-ux-mastery/templates/component-contract.md?raw";
import designAudit from "./skills/ui-ux-mastery/templates/design-audit.md?raw";

const skillBody = uiUxMasterySkill.replace(/^---[\s\S]*?---\s*/, "").trim();

const references = [
  { name: "Product Archetypes", content: productArchetypes },
  { name: "Design System", content: designSystem },
  { name: "Component Contracts", content: componentContracts },
  { name: "Accessibility", content: accessibility },
  { name: "Anti-Slop and Distinctiveness", content: antiSlop },
  { name: "Design to Code", content: designToCode },
  { name: "Platform Patterns", content: platformPatterns },
  { name: "Quality Rubric", content: qualityRubric },
];

const templates = [
  { name: "Screen Spec", content: screenSpec },
  { name: "Component Contract", content: componentContract },
  { name: "Design Audit", content: designAudit },
];

const referencesBlock = references
  .map((r) => `<reference name="${r.name}">\n${r.content.trim()}\n</reference>`)
  .join("\n\n");

const templatesBlock = templates
  .map((t) => `<template name="${t.name}">\n${t.content.trim()}\n</template>`)
  .join("\n\n");

export const CAIDE_MOBILE_UI_SKILL_PACK = `
<mandatory-ui-ux-skill>
The following CAIDE skill is permanently enabled for every application build and edit. Follow it as a completion contract, not optional inspiration.

${skillBody}
</mandatory-ui-ux-skill>

<ui-ux-references>
The following reference documents provide detailed guidance for specific UX domains. Consult them when relevant to the task.

${referencesBlock}
</ui-ux-references>

<ui-ux-templates>
The following templates can be used to structure design work for screens, components, and audits.

${templatesBlock}
</ui-ux-templates>
`.trim();
