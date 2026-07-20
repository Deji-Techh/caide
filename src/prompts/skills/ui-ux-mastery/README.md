# World-Class UI/UX Production Skill

A production-oriented AI skill for creating, implementing, and auditing user interfaces.

## What is included

- `SKILL.md` — standalone authoritative skill.
- `references/product-archetypes.md` — product-specific design decisions.
- `references/design-system.md` — token and system architecture.
- `references/component-contracts.md` — component behavior and accessibility.
- `references/accessibility.md` — operational WCAG 2.2 guidance.
- `references/anti-slop.md` — generic AI-design detection and correction.
- `references/design-to-code.md` — repository-aware implementation process.
- `references/platform-patterns.md` — responsive, web, mobile, and desktop patterns.
- `references/quality-rubric.md` — expanded acceptance scoring.
- `templates/screen-spec.md` — reusable screen specification.
- `templates/component-contract.md` — reusable component contract.
- `templates/design-audit.md` — reusable audit template.

## Installation

Copy the folder into the skills directory used by your AI coding or design agent. Keep the folder structure intact so `SKILL.md` can reference the supporting material.

For systems that accept only one file, use `SKILL.md`; it contains the full operating workflow and remains functional without loading the references.

## Recommended use

Invoke the skill for:

- new product design;
- redesigns;
- design systems;
- production frontend implementation;
- UI/UX audits;
- mobile and desktop applications;
- dashboards and data products;
- creative tools and IDEs;
- AI assistants and agentic interfaces.

## Standards basis

The accessibility instructions target WCAG 2.2 AA for web interfaces and recommend applying current native platform accessibility guidance in addition to WCAG where relevant.

Official reference points:

- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- W3C WCAG 2.2 mobile guidance: https://www.w3.org/TR/wcag2mobile-22/
- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- Material Design: https://m3.material.io/
- GOV.UK Design System accessibility: https://design-system.service.gov.uk/accessibility/

## Design objective

The skill is designed to prevent an AI agent from jumping directly to fashionable styling. It requires the agent to understand the product, classify the archetype, model users and tasks, define flows, create a system, handle complete states, implement accessibly, inspect the rendered result, score it, and revise it.
