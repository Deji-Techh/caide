import { describe, expect, it } from "vitest";
import { constructLocalAgentPrompt } from "./local_agent_prompt";
import { CAIDE_MOBILE_UI_SKILL_PACK } from "./mobile_ui_skill_pack";
import { getSystemPromptForChatMode } from "./system_prompt";

const mandatoryMarkers = [
  "<mandatory-ui-ux-skill>",
  "World-Class UI/UX Production Skill",
  "## 0. Mission",
  "## 6. Full Production Workflow",
  "## 51. Final Directive",
  "Do not optimize for the appearance of design competence",
];

describe("CAIDE UI/UX mastery skill", () => {
  it("loads the permanent SKILL.md without its metadata frontmatter", () => {
    expect(CAIDE_MOBILE_UI_SKILL_PACK).not.toContain("name: world-class-ui-ux");
    for (const marker of mandatoryMarkers) {
      expect(CAIDE_MOBILE_UI_SKILL_PACK).toContain(marker);
    }
  });

  it("permanently wires production motion, product-flow, and backend skills", () => {
    for (const marker of [
      '<companion-skill name="Motion and Interaction">',
      '<companion-skill name="Product Flow">',
      '<companion-skill name="Backend Production">',
      "# Motion and Interaction Contract",
      "# Product Flow Contract",
      "# Backend Production Contract",
    ]) {
      expect(CAIDE_MOBILE_UI_SKILL_PACK).toContain(marker);
    }
  });

  it("requires distinct phone, landscape, and tablet compositions", () => {
    expect(CAIDE_MOBILE_UI_SKILL_PACK).toContain(
      "Responsive does not mean stretching or centering the same narrow phone column",
    );
    expect(CAIDE_MOBILE_UI_SKILL_PACK).toContain("844x390 phone landscape");
    expect(CAIDE_MOBILE_UI_SKILL_PACK).toContain("768x1024 tablet portrait");
    expect(CAIDE_MOBILE_UI_SKILL_PACK).toContain("1024x768 tablet landscape");
    expect(CAIDE_MOBILE_UI_SKILL_PACK).toContain(
      "Do not finish a build or edit until responsive behavior is implemented",
    );
  });

  it("includes all reference documents and templates", () => {
    expect(CAIDE_MOBILE_UI_SKILL_PACK).toContain("<ui-ux-references>");
    expect(CAIDE_MOBILE_UI_SKILL_PACK).toContain("<ui-ux-templates>");
    expect(CAIDE_MOBILE_UI_SKILL_PACK).toContain('name="Product Archetypes"');
    expect(CAIDE_MOBILE_UI_SKILL_PACK).toContain(
      'name="Anti-Slop and Distinctiveness"',
    );
    expect(CAIDE_MOBILE_UI_SKILL_PACK).toContain('name="Screen Spec"');
    expect(CAIDE_MOBILE_UI_SKILL_PACK).toContain('name="Design Audit"');
    expect(CAIDE_MOBILE_UI_SKILL_PACK).toContain(
      "# Product Archetype Decision Matrix",
    );
    expect(CAIDE_MOBILE_UI_SKILL_PACK).toContain(
      "# Screen Specification Template",
    );
    expect(CAIDE_MOBILE_UI_SKILL_PACK).toContain(
      "# Anti-Slop and Distinctiveness Reference",
    );
  });

  it("is always injected into the standard build agent", () => {
    const prompt = getSystemPromptForChatMode({
      chatMode: "build",
      enableTurboEditsV2: false,
    });
    for (const marker of mandatoryMarkers) {
      expect(prompt).toContain(marker);
    }
    expect(prompt).toContain("<ui-ux-references>");
    expect(prompt).toContain("<ui-ux-templates>");
  });

  it("is always injected into local and basic agent modes", () => {
    for (const prompt of [
      constructLocalAgentPrompt(undefined),
      constructLocalAgentPrompt(undefined, undefined, {
        basicAgentMode: true,
      }),
    ]) {
      for (const marker of mandatoryMarkers) {
        expect(prompt).toContain(marker);
      }
      expect(prompt).toContain("<ui-ux-references>");
      expect(prompt).toContain("<ui-ux-templates>");
    }
  });
});
