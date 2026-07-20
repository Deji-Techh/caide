# Product Archetype Decision Matrix

Use this reference after identifying the product's primary and secondary archetypes. It converts product type into concrete UX, density, navigation, content, and interaction decisions.

## 1. Classification Dimensions

Score each dimension before selecting patterns:

| Dimension | Low end | High end | Design consequence |
|---|---|---|---|
| Usage frequency | occasional | continuous | onboarding vs efficiency and shortcuts |
| User expertise | novice | specialist | explanation vs compact controls |
| Consequence of error | trivial | severe | speed vs verification and auditability |
| Data density | sparse | extreme | spacious storytelling vs structured density |
| Task duration | seconds | hours | transient flow vs persistent workspace |
| Collaboration | individual | multi-role | local state vs comments, permissions, presence |
| Connectivity | stable | intermittent | synchronous assumptions vs offline resilience |
| Content volatility | static | real-time | ordinary refresh vs visible freshness and conflict handling |
| Emotional context | relaxed | stressful | expressive delight vs calm clarity |
| Input method | touch | keyboard/mouse/mixed | target size vs compact acceleration |

Use the score to moderate archetype defaults. A novice-facing finance app should not inherit the density of a professional trading terminal merely because both are financial.

---

## 2. Marketing and Editorial Experiences

### Primary jobs

- understand value;
- evaluate credibility;
- compare options;
- learn;
- convert, subscribe, contact, download, or purchase.

### Recommended structure

- concise global navigation;
- a first viewport with clear category, promise, audience, and next action;
- evidence near claims;
- progressive detail;
- direct comparison for plans or alternatives;
- persistent but non-obstructive conversion path;
- robust footer and contact routes.

### Visual implications

- typography and content carry hierarchy;
- use fewer repeated cards;
- vary rhythm between narrative, evidence, demonstration, and conversion sections;
- imagery should demonstrate the product or establish credible context;
- use motion to explain or connect, not to delay access.

### Common failures

- vague hero copy;
- fake logos or metrics;
- repetitive icon-card grids;
- aggressive popups before value is understood;
- hidden pricing or material conditions;
- decorative product mockups that reveal no real workflow.

### Quality test

After five seconds, a new visitor should know what the product is, who it is for, why it matters, and the primary next step.

---

## 3. Consumer Mobile Applications

### Primary jobs

- complete a focused task quickly;
- return frequently with low reorientation cost;
- receive timely, controllable updates;
- manage identity and preferences.

### Recommended structure

- three to five primary destinations;
- clear first-run path;
- contextual permission requests;
- strong home state based on actual next actions;
- bottom navigation where destinations are peers;
- full-screen task flows for focused operations;
- sheets for short contextual choices;
- reliable drafts and interruption recovery.

### Visual implications

- comfortable targets;
- concise labels;
- strong state visibility;
- careful safe-area and keyboard behavior;
- limited simultaneous actions;
- familiar platform controls unless differentiation is valuable.

### Common failures

- onboarding carousel with no user value;
- mandatory account creation before product understanding;
- hidden gestures;
- excessive modals;
- desktop-style tables;
- permission prompts at launch without context;
- important actions in unreachable top corners.

---

## 4. Enterprise and Operational Software

### Primary jobs

- monitor status;
- find exceptions;
- process many records;
- coordinate roles;
- inspect history;
- comply with procedures;
- produce auditable outcomes.

### Recommended structure

- persistent navigation;
- object-oriented information architecture;
- saved views;
- powerful search and filters;
- dense tables with stable column behavior;
- clear bulk selection and actions;
- visible status and timestamps;
- role-aware actions;
- activity and audit history;
- keyboard accelerators.

### Visual implications

- compact density may be appropriate;
- alignment and predictable regions are more valuable than dramatic composition;
- color should emphasize exceptions, not decorate every area;
- controls should remain stable when data updates;
- use cards only when they create meaningful grouping.

### Common failures

- hiding critical controls to look minimal;
- converting tables into cards;
- ambiguous status chips;
- actions that move based on selection;
- filters that reset after navigation;
- no distinction between current, delayed, stale, and failed data;
- no partial failure handling.

### Quality test

An experienced user should complete repeated tasks with minimal pointer travel and without losing context.

---

## 5. Financial Products

### Primary jobs

- understand balances, obligations, exposure, and history;
- move or allocate money;
- verify identity;
- understand fees and consequences;
- resolve failed or pending transactions.

### Required design behavior

- always show currency and units;
- distinguish available, pending, held, and total amounts;
- show effective dates and data freshness;
- explain fees before commitment;
- use confirmation proportional to consequence;
- identify destination and amount in confirmations;
- preserve receipts and reference identifiers;
- make disputes and support findable;
- avoid promising certainty where values are estimated or volatile.

### Data visualization

- avoid decorative upward-trending charts;
- label basis, time range, and source;
- distinguish gain from deposit and loss from withdrawal;
- avoid colors that imply profit or safety where no such meaning exists;
- include exact values and accessible summaries.

### Common failures

- unclear sign conventions;
- missing transaction states;
- “successful” shown before final settlement;
- hidden exchange rates or network fees;
- destructive transfer controls too close to ordinary navigation;
- insufficient explanation of irreversible actions.

---

## 6. Healthcare Products

### Primary jobs

- view and understand health information;
- schedule or coordinate care;
- communicate with providers;
- record observations;
- make time-sensitive decisions safely.

### Required design behavior

- use plain language with professional terminology where necessary;
- distinguish patient-entered, clinician-entered, measured, estimated, and imported data;
- show units and reference ranges carefully;
- communicate uncertainty;
- use role and permission boundaries visibly;
- protect privacy in shared environments;
- avoid alarmist visuals for non-urgent information;
- ensure urgent pathways are prominent and unambiguous.

### Common failures

- using red for every abnormal value without context;
- hidden provenance;
- inaccessible charts;
- ambiguous “normal” labels;
- tiny controls in clinical workflows;
- no fallback when external records fail to load.

---

## 7. Developer Tools and IDEs

### Primary jobs

- navigate code and project structure;
- create and modify files;
- run, debug, test, and inspect;
- compare changes;
- manage version control;
- use automation without losing control.

### Recommended structure

- stable application shell;
- persistent editor context;
- resizable and dockable panels;
- tabs or editor groups;
- command palette;
- keyboard-first operation;
- visible diagnostics and source locations;
- clear running, stopped, failed, and stale states;
- recoverable terminal and task history.

### AI-specific additions

- show selected context and exclusions;
- distinguish suggestions from applied changes;
- show diffs;
- require permission for consequential commands;
- expose tool progress and errors;
- support cancel and rollback;
- preserve a record of agent actions.

### Common failures

- overlarge consumer-style controls;
- unstable panel positions;
- AI chat obscuring the editor;
- accepting changes without inspectable diff;
- terminal output without source mapping;
- hidden shortcut availability.

---

## 8. Creative Editors

### Primary jobs

- create, inspect, modify, organize, preview, and export artifacts.

### Recommended structure

- canvas or timeline as dominant region;
- left region for object/layer structure or assets;
- contextual inspector;
- persistent history and save state;
- clear selection and tool mode;
- direct manipulation with numerical alternatives;
- export separate from editable source.

### Interaction requirements

- visible snapping and constraints;
- modifier keys documented contextually;
- selection handles with sufficient contrast;
- undo and redo depth;
- history names that describe actions;
- safe destructive transformations;
- autosave and recovery;
- predictable zoom and pan.

### Common failures

- tiny unexplained icons;
- canvas covered by floating controls;
- destructive flattening without warning;
- tool mode remaining active unexpectedly;
- no way to enter exact values;
- ambiguous export progress.

---

## 9. AI Assistants and Agentic Products

### Primary jobs

- express intent;
- provide context;
- inspect output;
- refine or approve;
- supervise actions;
- recover from mistakes.

### Recommended structure

- input composer with contextual affordances;
- conversation or task timeline;
- visible tool/action events;
- citations and source access where needed;
- version controls for substantial artifacts;
- explicit action approval;
- status and cancellation;
- result editing;
- clear distinction between draft, proposed, running, and completed.

### Trust requirements

- do not present generated content as verified fact;
- explain material uncertainty;
- do not fabricate confidence percentages;
- distinguish user data from model inference;
- make external side effects visible;
- preserve the user's ability to stop and review.

### Common failures

- animated thinking indicators that provide no status;
- endless scrolling without task structure;
- tool actions hidden inside prose;
- no way to edit or branch;
- model selectors with unexplained names;
- permission prompts without target and consequence.

---

## 10. Marketplaces and Commerce

### Primary jobs

- discover;
- compare;
- evaluate trust;
- purchase;
- track;
- return or resolve.

### Recommended structure

- category and search routes;
- useful filters;
- comparison-ready listing cards;
- detail pages with price, availability, delivery, returns, and seller information;
- persistent cart;
- guest checkout when possible;
- address and payment recovery;
- order status history.

### Common failures

- hidden total cost;
- fake urgency;
- unclear variant selection;
- cart loss after authentication;
- unhelpful out-of-stock state;
- preselected add-ons;
- inaccessible image galleries.

---

## 11. Social and Community Products

### Primary jobs

- create identity;
- publish or communicate;
- discover people and content;
- manage relationships;
- control privacy and notifications;
- moderate harm.

### Required safety patterns

- reporting and blocking must be findable;
- audience and privacy must be visible before publishing;
- deletion and archival behavior must be clear;
- notification settings should be granular enough to reduce overload;
- moderation status should be communicated without unnecessary exposure.

### Common failures

- dark patterns that force contacts access;
- ambiguous public/private state;
- accidental posting to the wrong audience;
- infinite engagement loops without controls;
- report flows that lose evidence or context.

---

## 12. Public Service and Civic Products

### Primary jobs

- determine eligibility;
- complete a procedure;
- provide evidence;
- understand obligations;
- save and return;
- receive status and help.

### Recommended structure

- task-oriented landing pages;
- one clear question per step when complexity is high;
- plain language;
- visible progress;
- clear evidence requirements;
- save and resume;
- review before submission;
- receipt and reference;
- consistent help and contact.

### Common failures

- department-centric navigation;
- unexplained legal language;
- unnecessary account creation;
- session timeout without warning;
- loss of entered information;
- inaccessible document upload.

---

## 13. Hybrid Products

Many products combine archetypes. Choose a dominant mode per screen rather than blending every convention everywhere.

Examples:

- SaaS homepage: marketing archetype.
- SaaS workspace: enterprise or creator archetype.
- Billing page: financial archetype.
- AI copilot panel: AI archetype.
- Mobile companion: consumer mobile archetype.

A coherent brand can span these modes while density and interaction adapt to the task.
