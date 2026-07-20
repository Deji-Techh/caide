# Component Contracts Reference

A component is a reusable behavioral contract. Visual appearance alone is insufficient.

## 1. Universal Contract

Every component specification should answer:

1. What user problem does it solve?
2. When should it be used?
3. When should another pattern be used?
4. What is its semantic role?
5. What content is required and optional?
6. What states exist?
7. How does it behave with keyboard, pointer, touch, and assistive technology?
8. How does it respond to constrained width, long text, zoom, and localization?
9. What events does it emit?
10. What tests prove it works?

---

## 2. Buttons

### Anatomy

- container;
- label;
- optional leading or trailing icon;
- progress indicator;
- focus indicator.

### Variants

- primary;
- secondary;
- subtle or ghost;
- destructive;
- icon-only;
- split or menu button only when action hierarchy justifies it.

### Rules

- label the result, not the mechanism;
- one primary action per decision region;
- preserve width while loading when possible;
- prevent duplicate submissions;
- do not disable without explaining why when the reason is not obvious;
- use `button` semantics for actions;
- icon-only buttons require an accessible name and usually a tooltip for sighted users;
- destructive styling is reserved for destructive actions.

### States

Default, hover where available, pressed, focus, disabled, loading, success where useful, and destructive confirmation outside the component when consequence requires it.

### Test cases

- long translated label;
- icon failure;
- loading and repeated activation;
- keyboard activation with Enter and Space;
- disabled discoverability;
- high contrast;
- narrow container.

---

## 3. Links

- use links for navigation or resource retrieval;
- link text must describe destination or purpose;
- distinguish links from ordinary text without relying only on hue;
- external, download, and new-window behavior should be communicated where material;
- do not style links as buttons unless their visual action hierarchy requires it while preserving link semantics.

---

## 4. Text Inputs

### Anatomy

- persistent label;
- input;
- optional prefix or suffix;
- helper text;
- error or warning;
- character count where meaningful;
- optional clear or reveal action.

### Rules

- connect label and description programmatically;
- use appropriate input type and autocomplete;
- preserve value after validation failure;
- do not use placeholder as the only label;
- avoid auto-formatting that moves the cursor unpredictably;
- make password reveal state explicit;
- support paste and password managers;
- error text should be specific and connected to the field.

### States

Empty, filled, focus, valid where useful, invalid, warning, disabled, read-only, loading or checking, autofilled.

---

## 5. Select, Combobox, and Autocomplete

Use a native select for small, stable option sets where native behavior is acceptable. Use a custom combobox when search, rich options, creation, or large datasets require it.

Define:

- open and close behavior;
- typing and filtering;
- highlighted versus selected option;
- empty result;
- loading;
- keyboard navigation;
- multi-select behavior;
- token removal;
- virtualization if needed;
- mobile presentation.

Do not call a list of links a select. Do not trap typed text without exposing how to clear it.

---

## 6. Checkbox, Radio, Switch, and Segmented Control

### Checkbox

Use for independent binary selections or selecting multiple items.

### Radio

Use for one choice from a small visible set.

### Switch

Use for an immediately applied on/off setting. The label should describe the controlled state, not the action “Enable”.

### Segmented control

Use for a small set of peer views or modes where immediate switching is safe.

Rules:

- entire label-target region should be clickable;
- state must not rely on color alone;
- use groups and legends for related controls;
- mixed checkbox state must be explicit;
- avoid switches for actions requiring Save unless product convention makes the deferred application clear.

---

## 7. Tabs

Tabs switch among peer panels within the same context.

Define:

- selected tab;
- focus behavior;
- automatic or manual activation;
- arrow-key behavior;
- overflow;
- count badges;
- disabled tabs if unavoidable;
- deep-linking and history;
- preservation of panel state.

Do not use tabs for sequential steps or unrelated global destinations.

---

## 8. Menus and Popovers

### Menus

Use for a list of actions or choices. Support arrow-key navigation, Escape, typeahead where useful, and focus return.

### Popovers

Use for contextual content or controls that do not require modal interruption.

Define:

- anchor and positioning;
- collision and viewport handling;
- dismissal;
- focus management;
- nested behavior;
- touch transformation;
- behavior on scroll and resize.

Avoid nesting interactive popovers deeply.

---

## 9. Dialogs

Use dialogs only when the user must complete, confirm, or acknowledge a focused interruption before returning.

### Requirements

- clear title;
- concise purpose;
- logical initial focus;
- focus containment;
- Escape behavior except when safety requires explicit choice;
- focus return;
- background inertness;
- scroll handling;
- mobile layout;
- action hierarchy;
- no dialog-on-dialog stacking by default.

For destructive dialogs, name the object and consequence. Do not rely on a generic “Are you sure?”.

---

## 10. Toasts and Notifications

Use toasts for transient, non-blocking feedback that does not require immediate decision.

- critical errors should remain available in context;
- time-sensitive content must not disappear before it can be read;
- pause or extend timing on hover/focus where relevant;
- support accessible status announcements;
- include Undo for reversible actions when appropriate;
- do not use toasts as the only record of important outcomes.

---

## 11. Cards

Cards group related content and actions. They are not the default wrapper for every region.

Define whether:

- the entire card is interactive;
- nested actions exist;
- selected state exists;
- media has a fixed ratio;
- metadata truncates or wraps;
- cards become list rows at dense widths;
- focus and hover communicate the same affordance.

Avoid nested clickable regions with conflicting destinations.

---

## 12. Tables

A table contract should define:

- columns and priorities;
- header associations;
- sorting;
- filtering;
- selection;
- row actions;
- bulk actions;
- sticky regions;
- resizing;
- virtualization;
- empty and loading rows;
- responsive strategy;
- keyboard model;
- export;
- screen-reader behavior.

Do not put essential row actions only on hover.

---

## 13. Navigation Components

### Sidebar

Define expanded, collapsed, mobile, current, nested, and permission-hidden states. Collapsed icon-only navigation needs labels through tooltips and accessible names.

### Bottom navigation

Use a small number of stable primary destinations. Preserve labels unless platform evidence strongly supports icon-only recognition.

### Breadcrumbs

Represent hierarchy, not browser history. Current page is normally not a link.

### Command palette

An accelerator for users who know or can search commands. It must not be the only way to discover critical functionality.

---

## 14. File Upload

Define:

- accepted types and limits before selection;
- browse and drag/drop;
- keyboard alternative;
- preview;
- progress;
- cancel;
- retry;
- duplicate handling;
- virus or processing state;
- partial failure;
- removal;
- privacy and retention;
- mobile capture if applicable.

Do not rely on drag-and-drop as the only method.

---

## 15. Date and Time

- respect locale and time zone;
- show format hints;
- allow typing where efficient;
- make calendar keyboard operable;
- distinguish date from date-time;
- communicate whether end dates are inclusive;
- show relative time with access to exact time when precision matters;
- handle daylight-saving transitions.

---

## 16. Component Acceptance Checklist

- [ ] Correct semantic element or pattern.
- [ ] Accessible name and description.
- [ ] Complete keyboard behavior.
- [ ] Visible focus.
- [ ] Pointer and touch behavior.
- [ ] Long content and localization.
- [ ] Zoom and text scaling.
- [ ] Light, dark, and high-contrast behavior where supported.
- [ ] Loading, empty, error, disabled, and read-only states where applicable.
- [ ] Events are stable and documented.
- [ ] Tests cover interaction and accessibility.
