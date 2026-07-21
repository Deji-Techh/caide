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
import motionInteractionSkill from "./skills/motion-interaction/SKILL.md?raw";
import productFlowSkill from "./skills/product-flow/SKILL.md?raw";
import backendProductionSkill from "./skills/backend-production/SKILL.md?raw";

const stripFrontmatter = (content: string) =>
  content.replace(/^---[\s\S]*?---\s*/, "").trim();

const skillBody = stripFrontmatter(uiUxMasterySkill);
const companionSkills = [
  { name: "Motion and Interaction", content: motionInteractionSkill },
  { name: "Product Flow", content: productFlowSkill },
  { name: "Backend Production", content: backendProductionSkill },
]
  .map(
    (skill) =>
      `<companion-skill name="${skill.name}">\n${stripFrontmatter(skill.content)}\n</companion-skill>`,
  )
  .join("\n\n");

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

## CAIDE preview contract
- CAIDE already renders the app inside the selected phone, foldable, tablet, or responsive frame. Render only the application screen.
- Never create a fake device, phone bezel, browser toolbar, status-bar shell, or "Made with" badge inside the generated app.
- Never wrap the app root in a fixed phone-sized canvas such as 390x780. The document, body, #root, and top-level application shell must fill the available frame with width: 100%, min-width: 0, and min-height: 100dvh where appropriate.
- Remove starter-template constraints such as #root max-width with margin: 0 auto and body-level flex/place-items centering. Apply max-width only to intentional inner content, never to the application viewport.
- Verify every screen at compact phone, large phone, tablet, landscape, and responsive widths. There must be no page-level horizontal scrolling, clipped actions, overlapping controls, or unusable empty space.

${skillBody}

${companionSkills}
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
