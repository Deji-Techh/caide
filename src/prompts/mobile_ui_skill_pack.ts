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
- Responsive does not mean stretching or centering the same narrow phone column. A full-height max-w-sm or max-w-md primary shell centered inside a tablet or landscape viewport is a failure, even when it does not overflow.
- Build deliberate adaptive compositions with CSS media/container queries or responsive utility variants: phone portrait may use one column; phone landscape must use the short height efficiently and recompose dense sections into columns or panes; tablet portrait and tablet landscape must widen content, navigation, grids, dialogs, and primary workflows instead of leaving large unused gutters.
- Verify every top-level screen and important state at 320x568 compact phone, 390x844 large phone, 844x390 phone landscape, 768x1024 tablet portrait, and 1024x768 tablet landscape. At each size, confirm intentional use of available width and height, no page-level horizontal scrolling, no clipped actions, no overlapping controls, no inaccessible content, and no narrow phone layout floating in empty tablet space.
- Do not finish a build or edit until responsive behavior is implemented in code for all five viewport classes. If browser automation is available, render and interact with each viewport; otherwise inspect every screen's layout classes and media/container rules explicitly.

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
