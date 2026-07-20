# Design-to-Code Reference

This reference governs implementation when an AI agent is asked to build or modify a real interface. The objective is not merely visual similarity. The implementation must preserve behavior, accessibility, responsiveness, maintainability, and performance.

## 1. Repository Reconnaissance

Before changing code, inspect:

- package manager and lockfile;
- framework and runtime versions;
- application entry points;
- routing;
- rendering model;
- styling approach;
- component library;
- design tokens;
- icon and chart libraries;
- state management;
- data-fetching layer;
- forms and validation;
- authentication and permissions;
- tests;
- lint, type-check, build, and preview scripts;
- public assets and fonts;
- existing responsive behavior;
- error boundaries and loading states.

Record constraints that affect design. Do not propose interactions the repository cannot support without stating the required backend or architecture changes.

---

## 2. Preserve Before Improving

Identify:

- working features;
- hidden states;
- analytics hooks;
- accessibility behavior;
- permission checks;
- validation;
- persistence;
- deep links;
- keyboard shortcuts;
- test assumptions.

A visual rewrite that deletes these is a regression.

---

## 3. Architecture Decisions

### Component boundaries

Create components around stable behavior, reuse, and accessibility—not arbitrary file-size targets.

Good boundaries often include:

- application shell;
- navigation regions;
- object list and row;
- toolbar;
- form field wrappers;
- dialog and popover primitives;
- data visualization wrappers;
- repeated state surfaces;
- domain-specific composite patterns.

### State location

Keep state as local as practical and as shared as necessary. Distinguish:

- server state;
- URL state;
- form state;
- ephemeral UI state;
- persistent preference state;
- collaborative or real-time state.

Do not move all state into a global store for convenience.

### URL behavior

Filters, selected tabs, search queries, or object identity should be reflected in the URL when users benefit from refresh, history, bookmarking, or sharing.

---

## 4. Styling and Tokens

- use the existing styling system unless migration is part of scope;
- centralize semantic tokens;
- avoid arbitrary values in repeated components;
- do not mix multiple competing styling approaches casually;
- support theme variables;
- keep focus and interaction states in component styles;
- use logical properties for internationalization where appropriate;
- avoid specificity wars and unnecessary `!important`.

When using utility classes, create semantic component abstractions rather than copying long inconsistent class lists across screens.

---

## 5. Semantic Structure

Implementation should expose the intended structure:

- one meaningful page heading;
- headings in logical order;
- landmarks;
- lists for lists;
- tables for comparative tabular data;
- buttons for actions;
- links for navigation;
- labels and descriptions for fields;
- status messages for asynchronous changes.

Do not build the entire application from generic `div` elements with click handlers.

---

## 6. Responsive Implementation

Define behavior at the component level.

For each major component, answer:

- minimum viable width;
- wrapping behavior;
- truncation behavior;
- overflow strategy;
- order changes;
- hidden detail;
- alternate interaction;
- sticky behavior;
- container query or viewport query;
- touch adaptation.

Test content-driven breakpoints. Do not add a breakpoint only because a popular framework defines it.

---

## 7. Async and Data States

Every data region should handle:

- initial request;
- loading;
- cached or stale content;
- refresh;
- empty;
- partial data;
- recoverable error;
- unauthorized;
- offline;
- cancellation;
- optimistic update and rollback where used.

Do not replace the entire page with a spinner when only one panel is updating.

---

## 8. Forms

- use a form element and native submission behavior where appropriate;
- define client and server validation responsibilities;
- map server errors to fields and a summary;
- preserve values;
- prevent duplicate submission;
- support keyboard submission intentionally;
- use autocomplete and appropriate input types;
- do not block paste;
- expose pending state;
- handle network failure after submit.

---

## 9. Focus Management

Focus changes must be deliberate.

Move focus when:

- a modal opens;
- a modal closes and returns focus;
- a route change needs page orientation;
- an error summary should be announced;
- dynamically inserted content requires immediate action.

Do not move focus for routine background updates.

---

## 10. Performance

### Loading

- prioritize critical content;
- defer noncritical modules;
- avoid loading large libraries for one minor effect;
- optimize route-level splitting;
- prevent duplicate requests;
- cache appropriately.

### Rendering

- avoid unnecessary rerenders;
- virtualize only genuinely large lists;
- use stable keys;
- avoid measuring layout repeatedly;
- reserve media dimensions;
- avoid expensive effects on large surfaces.

### Assets

- use responsive images;
- choose appropriate formats;
- preload only critical assets;
- subset fonts when appropriate;
- limit font families and weights;
- provide fallbacks.

### Perceived performance

- acknowledge actions immediately;
- preserve existing content during refresh;
- use skeletons matching final structure;
- show progress based on real stages;
- support cancellation for long operations.

---

## 11. Animation Implementation

- use transform and opacity for common transitions;
- avoid animating layout dimensions in large repeated regions;
- clean up event listeners and animation state;
- respect reduced motion;
- ensure animation does not delay interaction;
- do not animate initial render so heavily that content becomes inaccessible.

---

## 12. Testing Pyramid

### Unit tests

Use for pure logic, formatting, token transforms, validation, and reducers.

### Component tests

Use for states, keyboard behavior, accessible names, validation, and event contracts.

### Integration tests

Use for data loading, routing, permission behavior, and multi-component workflows.

### End-to-end tests

Use for critical user journeys and high-risk actions.

### Visual regression

Use for layout, theming, component states, and responsive snapshots. Do not use snapshots as the only interaction test.

### Manual inspection

Inspect rendered output at target widths and interaction states. Source code review cannot detect every visual defect.

---

## 13. Implementation Completion Record

Report:

- files changed;
- components added or modified;
- tokens added or modified;
- behavior preserved;
- responsive transformations;
- accessibility behavior;
- tests run and results;
- untested areas;
- backend dependencies;
- known limitations;
- migration notes.

---

## 14. Prohibited Shortcuts

Do not:

- replace real data flow with hard-coded mock values without disclosure;
- remove tests because the redesign breaks them;
- disable lint or type checking to force a build;
- silence accessibility warnings without correction;
- make every component client-rendered without need;
- add dependencies without inspecting existing capability;
- hide overflow to conceal layout defects;
- use `outline: none` without a visible replacement;
- block zoom;
- intercept native scrolling without a strong reason;
- ship only the default state.
