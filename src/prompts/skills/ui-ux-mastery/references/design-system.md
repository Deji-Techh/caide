# Design-System Architecture Reference

A design system is a governed set of decisions, tokens, components, patterns, content rules, and validation methods. It is not merely a component gallery.

## 1. System Layers

### 1.1 Foundations

- brand principles;
- accessibility target;
- platform scope;
- color;
- typography;
- spacing;
- layout;
- motion;
- iconography;
- imagery;
- elevation;
- density;
- content voice.

### 1.2 Tokens

Tokens encode repeatable decisions. Maintain:

- primitive tokens;
- semantic tokens;
- component tokens;
- theme aliases;
- platform mappings.

### 1.3 Components

Components package visual, behavioral, accessibility, and content contracts.

### 1.4 Patterns

Patterns combine components for recurring tasks such as:

- authentication;
- search and filters;
- bulk operations;
- onboarding;
- empty states;
- destructive confirmation;
- permissions;
- file upload;
- checkout;
- import and export.

### 1.5 Templates

Templates establish page-level structure without fixing content.

### 1.6 Governance

Governance defines contribution, testing, versioning, migration, ownership, and deprecation.

---

## 2. Token Architecture

### 2.1 Primitive tokens

Raw values:

```css
--blue-600: #2563eb;
--neutral-950: #0a0a0a;
--space-4: 1rem;
--radius-2: 0.5rem;
```

Primitive names are implementation facts. Components should rarely consume them directly.

### 2.2 Semantic tokens

Purpose-based aliases:

```css
--surface-canvas: var(--neutral-0);
--surface-raised: var(--neutral-0);
--text-primary: var(--neutral-950);
--text-secondary: var(--neutral-600);
--border-default: var(--neutral-200);
--action-primary-bg: var(--blue-600);
--focus-ring: var(--blue-500);
```

### 2.3 Component tokens

Use when a component has stable needs not shared across the system:

```css
--button-primary-bg: var(--action-primary-bg);
--button-primary-bg-hover: var(--action-primary-bg-hover);
--button-radius: var(--control-radius);
```

Avoid creating component tokens that merely duplicate semantic tokens without adding stability or theming value.

### 2.4 Token invariants

- semantic meaning must remain stable across themes;
- token changes must be reviewable;
- component code must not scatter arbitrary values;
- generated tokens must have source-of-truth ownership;
- aliases must not form confusing circular chains;
- contrast must be tested after resolution.

---

## 3. Color System

### 3.1 Surface model

Define a small number of surface roles:

- canvas;
- base surface;
- raised surface;
- overlay;
- selected surface;
- inverse surface.

Do not create a different gray background for every container.

### 3.2 Text model

- primary;
- secondary;
- tertiary only if contrast remains sufficient;
- inverse;
- disabled;
- link;
- code or data when distinct.

### 3.3 Action model

- primary action;
- primary hover and pressed;
- secondary action;
- subtle action;
- destructive action;
- disabled action;
- focus.

### 3.4 Status model

For each status family define:

- foreground;
- background;
- border;
- icon;
- focus or interactive treatment if status components are interactive.

Do not assume a single green, amber, and red value works on every surface.

### 3.5 Theme generation

Do not generate dark mode by numerical inversion. Re-evaluate:

- relative elevation;
- text contrast;
- border visibility;
- saturation;
- images;
- code syntax colors;
- chart colors;
- focus;
- disabled states;
- shadows;
- system bars.

---

## 4. Typography System

### 4.1 Define roles, not only sizes

Example:

| Role | Typical use | Key concern |
|---|---|---|
| display | campaign or major product statement | character, controlled use |
| title-1 | page or object title | immediate orientation |
| title-2 | major section | hierarchy |
| title-3 | local group | compact clarity |
| body | ordinary reading | legibility |
| body-compact | dense tools and tables | efficient scanning |
| label | controls and metadata | clarity at small size |
| data | values and metrics | numeral alignment |
| code | code and identifiers | glyph distinction |

### 4.2 Fluid type

Use fluid sizing selectively. Body text should remain predictable. Large editorial headings may use `clamp()` where line breaks are controlled.

### 4.3 Font loading

- subset when appropriate;
- prefer variable fonts when they reduce transfer and cover needed axes;
- use fallback metrics to reduce layout shift;
- avoid excessive families and weights;
- test characters used by target locales.

---

## 5. Spacing and Sizing

### 5.1 Base unit

A 4px base allows compact and comfortable patterns. Use semantic spacing aliases for recurring relationships:

```text
space.inline-tight
space.inline-default
space.stack-tight
space.stack-default
space.section
space.page-gutter
```

### 5.2 Control sizing

Define control sizes by context:

- compact: dense desktop tools;
- default: ordinary application use;
- comfortable: touch or high-frequency consumer use;
- large: prominent actions and accessibility needs.

The visible shape may be smaller than the hit area only if implementation preserves an adequate target without overlap or ambiguity.

### 5.3 Radius

Use a limited radius system tied to scale and product character. Do not use the same large radius for tiny inputs and full-page panels.

---

## 6. Elevation and Layering

### 6.1 Elevation purposes

Use elevation to represent:

- overlay above base content;
- temporary menus and popovers;
- draggable or selected objects;
- sticky regions;
- modal interruption.

Do not apply shadows to every card.

### 6.2 Z-index scale

Create named layers:

```text
base
sticky
navigation
popover
scrim
modal
notification
debug
```

Avoid arbitrary values such as `999999`.

### 6.3 Overlays

Define:

- focus behavior;
- dismissal;
- escape behavior;
- click-outside behavior;
- background interaction;
- scroll locking;
- stacking;
- mobile transformation.

---

## 7. Motion Tokens

Define semantic durations and easings:

```text
motion.instant
motion.fast
motion.standard
motion.slow
motion.enter
motion.exit
motion.emphasized
```

Also define reduced-motion behavior. Motion tokens must not force every component to animate.

---

## 8. Density

### 8.1 Density strategy

Density should reflect task frequency and expertise. Provide modes only when users benefit from control or roles differ substantially.

### 8.2 What changes

- row and control height;
- padding;
- metadata visibility;
- icon size;
- gap;
- table density;
- toolbar wrapping.

### 8.3 What should remain stable

- hierarchy;
- semantics;
- focus visibility;
- target separation;
- action order;
- status meaning.

---

## 9. Component Governance

### 9.1 Maturity

- experimental;
- alpha;
- beta;
- stable;
- deprecated.

### 9.2 Contribution requirements

A new component proposal should include:

- use cases;
- evidence existing components cannot satisfy them;
- anatomy and behavior;
- accessibility review;
- content rules;
- responsive behavior;
- tests;
- migration impact;
- ownership.

### 9.3 Deprecation

- mark deprecated APIs;
- provide replacement;
- provide migration examples;
- define removal schedule;
- avoid silent behavioral change.

---

## 10. Documentation Standard

Each component page should contain:

- summary;
- demo;
- use and avoid guidance;
- anatomy;
- variants;
- states;
- content guidance;
- accessibility;
- keyboard interaction;
- responsive behavior;
- API;
- examples;
- known limitations;
- tests.

Document real edge cases, not only the default example.

---

## 11. Quality Control

A design-system release should verify:

- token build;
- visual regression;
- unit and interaction tests;
- accessibility checks;
- keyboard behavior;
- high-contrast mode;
- light and dark themes;
- localization stress;
- responsive rendering;
- dependency compatibility;
- migration notes.

---

## 12. System Failure Patterns

Avoid:

- multiple overlapping button components;
- design tokens that exist only in Figma or only in code;
- semantic names tied to current hue;
- components with undocumented internal spacing;
- uncontrolled variant combinations;
- accessibility delegated to consumers;
- one-off page CSS overriding system behavior;
- governance so strict that teams bypass the system;
- documentation screenshots that do not match production components.
