# Accessibility Reference

This reference operationalizes accessibility for interface design and implementation. Target WCAG 2.2 AA for web work unless requirements specify another standard. Platform guidance remains relevant for native applications.

## 1. Accessibility Workstream

Accessibility must be considered during:

1. requirements;
2. information architecture;
3. component selection;
4. visual design;
5. content writing;
6. implementation;
7. testing;
8. release and monitoring.

An automated scan is not a complete accessibility review.

---

## 2. Perceivable

### Text alternatives

- meaningful images need concise alternatives based on function and context;
- decorative images should be ignored by assistive technology;
- complex charts need a summary and access to underlying data where appropriate;
- icon-only controls need accessible names.

### Media

Provide captions, transcripts, audio description, and accessible controls according to content and conformance requirements.

### Adaptability

- use semantic structure;
- do not encode meaning only through visual position;
- preserve reading order when layout changes;
- ensure zoom and text spacing do not break content;
- support orientation unless a specific orientation is essential.

### Contrast

Verify actual rendered colors for:

- normal text;
- large text;
- icons and control boundaries;
- focus indicators;
- chart elements;
- disabled or placeholder content if it must remain readable.

Do not assume a design token name guarantees compliance.

---

## 3. Operable

### Keyboard

All ordinary functionality should be operable without a pointer.

Check:

- logical tab order;
- no positive `tabindex` used to repair poor DOM order;
- visible focus;
- no keyboard trap;
- skip links or efficient landmark navigation;
- dialogs contain and restore focus;
- menus, tabs, grids, trees, and comboboxes follow established patterns;
- shortcuts do not conflict and can be disabled or remapped when necessary.

### Focus not obscured

Sticky headers, cookie banners, toolbars, bottom bars, and overlays must not hide the focused element. Test keyboard navigation at zoomed layouts.

### Target size

WCAG 2.2 AA defines 24 by 24 CSS pixels as the minimum pointer target with exceptions. Larger targets are generally needed for comfortable touch. Consider spacing, motor control, context, and platform conventions.

### Dragging

When a function uses dragging, provide a single-pointer alternative unless dragging is essential. Examples:

- move up/down buttons for ordering;
- numeric position inputs;
- menu-based transfer between lists;
- click-to-select followed by click-to-place.

### Timing

- avoid time limits;
- warn before session expiration;
- allow extension where possible;
- preserve work;
- let users pause moving or updating content.

### Motion and flashing

- respect reduced motion;
- avoid large unrequested camera or parallax movement;
- avoid flashing that can trigger seizures;
- provide pause controls for auto-moving content.

---

## 4. Understandable

### Language

- declare page and passage language;
- use plain, specific labels;
- explain specialist terms when audience requires it;
- keep repeated labels and actions consistent.

### Predictability

- focus or input should not trigger unexpected navigation;
- repeated navigation should remain consistent;
- help mechanisms should appear consistently;
- state changes should be communicated.

### Errors

- identify the field and issue;
- provide correction guidance;
- preserve input;
- offer a summary for long forms;
- for high-stakes submissions, support review, correction, confirmation, or reversibility.

### Redundant entry

Do not require users to enter the same information twice in one process unless necessary for security or integrity. Offer selection or autofill.

### Accessible authentication

- allow password managers;
- allow copy and paste;
- avoid memory tests as the only route;
- provide alternatives to CAPTCHA where possible;
- clearly explain recovery.

---

## 5. Robust

- prefer native HTML semantics;
- use ARIA only to supplement missing semantics;
- expose name, role, value, state, and relationships;
- ensure custom controls update accessibility state;
- test with actual assistive technology for critical patterns;
- avoid invalid duplicate IDs and broken label references.

---

## 6. Common Pattern Requirements

### Dialog

- `dialog` semantics or correct equivalent;
- accessible title;
- focus moved into dialog;
- focus contained;
- Escape behavior;
- background inert;
- focus returned to trigger.

### Tabs

- tablist, tab, and tabpanel relationships;
- selected state;
- arrow-key navigation;
- manual or automatic activation chosen deliberately;
- inactive panels handled correctly.

### Combobox

- accessible name;
- expanded state;
- popup relationship;
- highlighted option state;
- typed value behavior;
- keyboard controls;
- announcement of result count when useful.

### Live updates

Use live regions for concise status changes, not entire streaming responses. Avoid repeated announcements that interrupt reading.

### Data grid

Use a grid interaction model only when cells are interactive and the product needs spreadsheet-like keyboard behavior. Ordinary data tables should remain tables.

---

## 7. Visual Design Stress Tests

Test:

- grayscale;
- color-vision simulations as supporting checks;
- 200% and 400% zoom where relevant;
- large platform text settings;
- forced colors or high contrast;
- reduced motion;
- narrow reflow;
- low vision with browser magnification;
- focus against every surface;
- status without color.

Simulations do not replace testing with disabled users.

---

## 8. Content Accessibility

- use descriptive headings;
- avoid “click here”;
- write instructions before controls when possible;
- provide examples for unfamiliar formats;
- define abbreviations;
- avoid long blocks of uppercase text;
- use lists and tables only when structure supports them;
- make error language direct and non-blaming;
- do not use sensory-only instructions such as “click the green button on the right”.

---

## 9. Mobile Accessibility

- support screen-reader exploration and action order;
- expose custom gestures through alternatives;
- support system text size;
- avoid fixed-height text containers;
- keep controls visible above the virtual keyboard;
- ensure orientation changes preserve state;
- label custom canvas controls;
- account for switch control, voice control, and external keyboard use.

---

## 10. Test Plan

### Automated

Use available tooling to catch:

- missing names;
- contrast issues where detectable;
- invalid ARIA;
- landmark and heading issues;
- form-label problems;
- common keyboard risks.

### Manual keyboard

Complete every critical flow using keyboard only.

### Screen reader

For critical flows, test at least one appropriate desktop or mobile screen reader. Verify orientation, form entry, errors, dialogs, dynamic updates, and completion.

### Visual adaptation

Test zoom, text scaling, high contrast, reduced motion, and reflow.

### Touch

Review target size, spacing, gesture alternatives, and accidental activation.

---

## 11. Accessibility Acceptance Record

Document:

- target standard;
- tested platforms and assistive technology;
- critical flows tested;
- automated tools used;
- known issues;
- severity;
- owner and remediation plan;
- exceptions and rationale.

Do not claim full compliance based only on an automated score.
