# Platform and Responsive Patterns Reference

Use platform conventions to reduce learning cost while preserving product identity. Do not imitate one platform's surface appearance on another without adapting behavior.

## 1. Responsive Strategy

### Content-driven breakpoints

Add a breakpoint when the current composition stops supporting:

- readable line length;
- adequate target size;
- meaningful comparison;
- stable navigation;
- visible primary actions;
- usable forms;
- non-overlapping content.

### Transformation types

- **Reflow:** columns stack or reorder.
- **Reduction:** secondary detail is hidden or summarized.
- **Replacement:** sidebar becomes drawer, table becomes prioritized list.
- **Relocation:** actions move to a bottom bar or overflow menu.
- **Resizing:** controlled change in spacing, type, or media.
- **Persistence:** critical regions remain visible.

Define transformations explicitly for each major region.

---

## 2. Web Applications

### Browser behavior

Respect:

- back and forward;
- refresh;
- deep links;
- opening links in new tabs;
- text selection;
- native scrolling;
- autofill and password managers;
- browser zoom;
- download behavior.

Do not create an app-like shell that breaks fundamental browser expectations.

### Navigation

Use URLs for meaningful state. Preserve history during tab or filter changes when users expect browser navigation.

### Layout

Account for:

- browser chrome on mobile;
- dynamic viewport units;
- safe areas;
- scrollbar space;
- responsive images;
- printing where relevant.

---

## 3. iOS and iPadOS

Use current platform conventions for navigation, safe areas, text scaling, controls, gestures, and accessibility.

### Common implications

- support Dynamic Type;
- respect safe areas;
- use familiar back behavior;
- avoid custom gestures as the only path;
- make destructive actions explicit;
- adapt popovers, sheets, and sidebars to device class;
- handle keyboard and pointer on iPad;
- preserve state through interruption and backgrounding.

Do not merely place web cards inside an iPhone frame.

---

## 4. Android

Use current Android and Material guidance where it supports the product.

### Common implications

- respect system back behavior;
- support dynamic text and display settings;
- account for gesture navigation and insets;
- use adaptive layouts for phones, tablets, foldables, and desktop modes;
- design notifications and permissions contextually;
- support keyboard and pointer where device form permits.

Do not assume every Android device has the same viewport, density, or navigation mode.

---

## 5. Desktop Applications

### Window behavior

Define:

- minimum size;
- resize behavior;
- maximized and full-screen modes;
- multi-window behavior;
- persistence of window position and layout;
- menus;
- shortcuts;
- file open/save conventions;
- drag and drop;
- operating-system theme integration.

### Density

Desktop tools may use compact controls, but must preserve accessible focus, target separation, and readable text.

### Native expectations

Respect platform-specific conventions for menus, title bars, window controls, file dialogs, and shortcuts unless the framework or product intentionally provides a cross-platform shell.

---

## 6. Tablet and Foldable Layouts

Do not treat tablets as enlarged phones.

Consider:

- split views;
- persistent sidebars;
- master-detail;
- drag and drop with alternatives;
- keyboard and pointer;
- posture and hinge;
- resizable windows;
- portrait and landscape;
- multi-tasking.

---

## 7. Touch Versus Pointer

### Touch

- larger targets;
- no hover dependence;
- gesture discoverability;
- thumb reach;
- accidental activation prevention;
- virtual keyboard management.

### Pointer

- hover may supplement, not replace, visible affordance;
- precise controls may be denser;
- context menus can accelerate;
- resize handles and drag affordances can be smaller visually while maintaining usability.

### Mixed input

Do not lock the interface into a “touch mode” or “mouse mode” based only on viewport width. Devices may support both concurrently.

---

## 8. Navigation Pattern Selection

| Pattern | Best for | Avoid when |
|---|---|---|
| top navigation | few broad website destinations | complex application hierarchy |
| sidebar | persistent app sections | simple short mobile flow |
| bottom navigation | 3–5 primary mobile destinations | many unstable destinations |
| tabs | peer views of same context | unrelated global sections |
| breadcrumb | deep hierarchy | flat app navigation |
| command palette | expert acceleration | sole discovery route |
| hub | occasional task selection | continuous professional workspace |
| master-detail | object lists and inspection | unrelated content types |

---

## 9. Responsive Data Patterns

### Tables

Options:

- horizontal scroll with sticky key columns;
- priority columns;
- column chooser;
- summary row to detail;
- dedicated mobile list;
- chart plus accessible detail table.

### Charts

- reduce series;
- direct-label key data;
- provide focusable data points or summary;
- avoid tiny legends;
- maintain honest scales;
- allow full-screen inspection where useful.

### Toolbars

- preserve primary actions;
- move low-frequency actions to overflow;
- do not change action labels unpredictably;
- avoid wrapping into multiple ambiguous rows unless grouped.

---

## 10. Responsive Testing Matrix

At minimum test:

- 320 CSS px or product minimum;
- common mobile portrait;
- mobile landscape where supported;
- tablet portrait;
- tablet landscape;
- standard laptop;
- wide desktop;
- browser zoom at 200%;
- longest supported language sample;
- virtual keyboard open;
- reduced motion;
- system text enlargement.

The exact matrix should match supported platforms and analytics.
