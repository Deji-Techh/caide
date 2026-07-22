# ANTI_AI_SLOP.md

## Purpose

This document is a permanent design and implementation standard for every product, screen, flow, component, prototype, and redesign created by the agent.

The goal is not to make interfaces that merely look polished in a screenshot. The goal is to create interfaces that feel intentionally designed for a specific product, user, platform, and task.

A visually busy interface is not automatically sophisticated. A dark theme, gradient, glow, glass card, oversized hero, rounded rectangle, floating button, or animated background is not evidence of good design.

**Product clarity, hierarchy, usability, restraint, consistency, accessibility, and implementation quality take priority over decoration.**

---

# 1. Core operating rule

Before designing or coding any interface, determine:

1. Who is using it?
2. What is the primary job they are trying to complete?
3. What information must be visible immediately?
4. What information can be secondary, collapsed, deferred, or removed?
5. What platform is being targeted: mobile, tablet, desktop, web, TV, wearable, or cross-platform?
6. What established interaction patterns do users already understand on that platform?
7. What makes this product distinct from a generic template?

Do not begin with colors, gradients, cards, icons, or animations.

Begin with the product model, user flow, information architecture, and content hierarchy.

---

# 2. Definition of AI slop

An interface should be treated as AI slop when several of the following are present:

- The screen resembles a generic dashboard, SaaS template, crypto app, or Dribbble mockup regardless of the product domain.
- Every section is placed inside a rounded card.
- Cards are nested inside other cards without a structural reason.
- Excessive gradients, neon accents, glows, glassmorphism, blur, noise, or animated decoration are used to simulate quality.
- The interface contains multiple competing primary actions.
- Typography is too small, too faint, too compressed, or too varied.
- Spacing appears random rather than systemized.
- Pills are used for ordinary buttons, tabs, fields, labels, filters, and navigation at the same time.
- The hierarchy depends mainly on color rather than size, weight, spacing, and placement.
- Generic copy such as "Welcome back," "Discover more," "Power your workflow," or "What's happening?" is inserted without product-specific purpose.
- The design copies visual trends without considering usability, platform conventions, or product context.
- Icons are added wherever text would be clearer.
- UI elements are visually impressive in isolation but do not form a coherent flow.
- Mobile layouts are desktop layouts squeezed into a narrow viewport.
- Desktop layouts are mobile cards stretched across a large screen.
- Empty space is filled with decoration instead of improving structure.
- Important actions are hidden behind unexplained icons.
- A floating action button overlaps content, bottom navigation, keyboards, or system controls.
- Content density is either unnecessarily cramped or artificially sparse.
- The interface lacks loading, empty, error, disabled, offline, permission, and success states.
- The implementation uses arbitrary pixel values, absolute positioning, and one-off CSS until the screenshot "looks right."

The agent must actively detect and remove these patterns.

---

# 3. Non-negotiable principles

## 3.1 Product logic before visual styling

Every screen must have a clear purpose.

A user should be able to answer these questions within a few seconds:

- Where am I?
- What can I do here?
- What is most important?
- What happened after my last action?
- How do I go back or recover from a mistake?

If a screen cannot answer these questions, visual polish must stop until the structure is corrected.

## 3.2 One dominant task per screen

Each screen must have one clearly dominant user task.

Secondary actions may exist, but they must not compete visually with the primary action.

Do not place multiple buttons with the same visual weight unless they are genuinely equal choices.

## 3.3 Hierarchy must survive grayscale

The layout should remain understandable when color is removed.

Use:

- Scale
- Weight
- Spacing
- Alignment
- Position
- Grouping
- Contrast

Do not use accent colors as the only method of showing importance.

## 3.4 Restraint is the default

Start with the simplest viable visual system.

Add decoration only when it improves comprehension, feedback, brand expression, or emotional tone.

Every decorative element must justify its presence.

## 3.5 Familiar patterns are preferred

Use platform-native and widely understood conventions unless there is a measurable reason not to.

Do not reinvent navigation, search, forms, filters, dialogs, menus, pagination, tabs, or selection controls merely to appear original.

Originality should come from product thinking, content, workflow, brand character, and interaction quality—not from breaking basic usability.

---

# 4. Mandatory design process

The agent must follow this order for every substantial UI task.

## Step 1: Define the product context

Document:

- Target users
- Main use cases
- Platform
- Primary task
- Secondary tasks
- Content types
- User frequency: first-time, occasional, or daily
- Environmental constraints: one-handed use, low bandwidth, bright sunlight, large datasets, keyboard-heavy work, etc.

When information is missing, make explicit assumptions. Ask a question only when the missing information would materially change the architecture or workflow.

## Step 2: Create a screen and flow inventory

List the required screens and the transitions between them.

Include:

- Entry points
- Main path
- Alternative paths
- Back behavior
- Success state
- Failure state
- Empty state
- Permission state
- Destructive action confirmation

Do not design isolated screenshots without a complete flow.

## Step 3: Establish information architecture

Before styling, decide:

- What belongs on the screen
- What belongs in navigation
- What belongs in a menu
- What should be searchable
- What should be filtered
- What should be grouped
- What should be hidden until requested
- What should be removed entirely

## Step 4: Produce a low-fidelity structure

Build the screen using only:

- Boxes
- Text labels
- Basic controls
- Realistic content hierarchy

No gradients, shadows, illustration, glass effects, or decorative animation are allowed during this stage.

If the grayscale wireframe is confusing, styling is not permitted to continue.

## Step 5: Define the design system

Create a small token set before creating many components.

Required tokens:

- Color roles
- Typography roles
- Spacing scale
- Radius scale
- Border styles
- Elevation levels
- Motion durations
- Breakpoints
- Focus states
- Disabled states

## Step 6: Build reusable component contracts

Each component must define:

- Purpose
- Variants
- States
- Size rules
- Content limits
- Responsive behavior
- Accessibility behavior
- When not to use it

## Step 7: Validate the complete flow

Review the experience in sequence, not as disconnected screens.

Confirm that:

- Navigation is predictable
- User progress is preserved
- Errors are recoverable
- Success is acknowledged
- Destructive actions are deliberate
- Keyboard and touch interactions work
- Back behavior is correct

## Step 8: Run the anti-slop review

Use the scorecard in Section 18. Do not ship a screen that fails the review.

---

# 5. Layout rules

## 5.1 Use a consistent spacing system

Use a 4-point or 8-point spacing system.

Recommended spacing tokens:

- `4` — micro gap
- `8` — compact internal gap
- `12` — related control gap
- `16` — standard padding
- `24` — section separation
- `32` — major group separation
- `48` — large structural separation
- `64+` — page-level rhythm where appropriate

Do not introduce arbitrary values such as `13px`, `19px`, `27px`, or `37px` unless required by a precise technical constraint.

## 5.2 Align to a visible structure

Every element must align with at least one other meaningful element.

Avoid:

- Slightly different left edges
- Cards with inconsistent internal padding
- Labels that do not align with their fields
- Icons with inconsistent optical sizing
- Buttons with different heights in the same group
- Uneven vertical rhythm

## 5.3 Avoid card inflation

A card is appropriate when it represents a distinct object, selectable item, grouped action, temporary overlay, or separate information unit.

A card is not required merely because content exists.

Prefer:

- Section dividers
- Spacing
- Headings
- Lists
- Tables
- Background grouping
- Inline controls

Do not wrap every section in a bordered rounded rectangle.

## 5.4 Avoid nested containers

Do not place a card inside another card unless the inner element is an independently interactive or semantically distinct object.

Maximum recommended visual nesting depth: **two levels**.

## 5.5 Respect content density

High-frequency productivity tools may be dense.

Consumer onboarding may be spacious.

Marketplace lists should prioritize scannability.

Messaging should prioritize conversation continuity.

Do not apply the same density to every product category.

## 5.6 Use responsive composition, not shrinking

At each breakpoint, reconsider:

- Navigation model
- Number of columns
- Content priority
- Control placement
- Table behavior
- Sidebar behavior
- Dialog behavior
- Keyboard behavior
- Safe areas

Do not simply scale the desktop design down.

---

# 6. Typography rules

## 6.1 Limit the type scale

A typical screen should use no more than three or four clearly defined text levels.

Recommended roles:

- Display or page title
- Section heading
- Body
- Label or supporting text

Avoid using many near-identical font sizes.

## 6.2 Body text must be readable

Recommended minimums:

- Mobile body text: `15–17px`
- Desktop body text: `14–16px`
- Form labels: usually `13–14px`
- Captions or metadata: `12px` only when clearly secondary

Do not use tiny text to fit more content into a screenshot.

## 6.3 Use weight intentionally

Do not make every label semibold.

Recommended hierarchy:

- Regular for body text
- Medium for controls and emphasis
- Semibold for headings
- Bold only for strong emphasis or display use

## 6.4 Control line length

For long-form reading, target approximately `45–75` characters per line.

Avoid full-width paragraphs on large displays.

## 6.5 Do not use placeholder text as permanent labels

Input fields need persistent labels when ambiguity is possible.

Placeholder text is supporting guidance, not a substitute for a label.

---

# 7. Color rules

## 7.1 Use semantic color roles

Define colors by role, not by arbitrary shade names.

Examples:

- Background
- Surface
- Elevated surface
- Primary text
- Secondary text
- Border
- Accent
- Success
- Warning
- Danger
- Focus

## 7.2 Use one primary accent by default

A second accent may be used only when it has a distinct semantic or brand role.

Do not create a rainbow interface to make it feel rich.

## 7.3 Gradients require justification

Gradients are permitted only when they serve one of these purposes:

- Brand identity
- Data encoding
- Spatial depth that improves comprehension
- A deliberate hero or campaign moment

Do not use gradients as default button fills, card backgrounds, navigation backgrounds, borders, or page decoration.

## 7.4 Avoid excessive glow

Glow effects should not be used to simulate premium quality.

Glow is permitted only for a deliberate brand effect, focused state, or status signal. It must remain subtle and must not reduce legibility.

## 7.5 Maintain contrast

Text, icons, controls, borders, and focus indicators must meet practical accessibility standards.

Do not use faint gray-on-gray text to make the interface appear elegant.

---

# 8. Radius, borders, and elevation

## 8.1 Keep radius values limited

Recommended radius scale:

- `4–6px` — compact controls
- `8px` — standard controls and small surfaces
- `12px` — cards and panels
- `16px` — large containers or mobile sheets
- Fully rounded — avatars, status dots, chips, segmented controls, or genuine pill controls only

Do not make every rectangle a pill.

## 8.2 Use borders before shadows

For most interfaces, separation should come from:

1. Spacing
2. Background contrast
3. Border
4. Shadow

Use shadows sparingly.

## 8.3 Limit elevation levels

Recommended:

- Level 0: flat page content
- Level 1: card, sticky bar, or subtle raised control
- Level 2: popover, dialog, dropdown, or modal

Do not give every component a different shadow.

---

# 9. Buttons and actions

## 9.1 One primary action per context

A page, dialog, or panel should generally have one primary button.

Other actions should use secondary, tertiary, text, or menu treatments.

## 9.2 Button text must describe the result

Prefer:

- `Create account`
- `Publish post`
- `Save changes`
- `Send message`
- `Delete file`

Avoid vague labels such as:

- `Continue`
- `Proceed`
- `Submit`
- `Done`

Use vague labels only when the outcome is already unmistakable.

## 9.3 Icon-only buttons require clarity

Icon-only actions must have:

- A familiar icon
- Accessible label
- Tooltip on hover-capable devices
- Adequate touch target

Use text when the icon is not universally understood.

## 9.4 Floating action buttons are exceptional

A floating action button is permitted only when:

- There is one dominant creation action
- The action is frequently used
- It does not duplicate a visible primary button
- It does not overlap navigation, content, keyboard, safe areas, or device controls

Do not add a floating action button because mobile apps commonly have one.

## 9.5 Touch target minimum

Interactive elements should generally be at least `44 × 44px` on touch devices.

---

# 10. Navigation rules

## 10.1 Keep navigation stable

Primary navigation should not change location unexpectedly between screens.

## 10.2 Bottom navigation

Use bottom navigation only for three to five top-level destinations.

Every item must represent a peer destination.

Do not place actions, filters, or temporary modes beside destinations as though they are the same thing.

## 10.3 Tabs

Use tabs for sibling views within the same context.

Tabs are not a replacement for global navigation.

Avoid horizontally scrolling tab rows unless the content genuinely requires many categories.

## 10.4 Back behavior

Back must return the user to the previous logical state without losing work.

Do not use a close icon, browser back, modal dismissal, and navigation back interchangeably without a defined model.

## 10.5 Navigation labels

Use short, concrete, domain-specific labels.

Do not rely on icons alone for primary navigation unless the platform convention makes every destination unmistakable.

---

# 11. Forms

## 11.1 Reduce unnecessary fields

Every field must have a reason to exist at that point in the flow.

Defer optional or advanced information.

## 11.2 Use correct controls

Use:

- Radio buttons for one choice from a small visible set
- Checkboxes for independent multiple selections
- Switches for immediate on/off settings
- Select menus for longer option sets
- Searchable comboboxes for large datasets
- Date and time controls suited to the platform

Do not use a custom dropdown for everything.

## 11.3 Validate at the right time

- Validate formatting as the user leaves a field or when enough information exists.
- Do not show an error before the user has interacted.
- Explain how to fix the problem.
- Preserve entered values after an error.

## 11.4 Use mobile-appropriate form presentation

On narrow screens, use a full-screen form or bottom sheet when a small centered dialog creates cramped content, keyboard obstruction, or tiny controls.

## 11.5 Destructive actions

Destructive actions must be visually distinct, clearly labeled, and confirmed when the consequence is difficult to reverse.

---

# 12. Lists, feeds, dashboards, and marketplaces

## 12.1 Design for scanning

Repeated items must maintain a consistent internal structure.

Keep metadata in predictable positions.

## 12.2 Do not overload cards

A list item should not contain every available property, badge, icon, statistic, and action.

Show only what is needed to compare or decide.

Place secondary actions in a menu or detail view.

## 12.3 Use realistic content

Content length must vary realistically.

Test:

- Long names
- Missing images
- Large numbers
- Small numbers
- Multiple badges
- No badges
- Wrapped titles
- Localization expansion

Do not design only for perfect placeholder content.

## 12.4 Dashboard discipline

A dashboard must answer concrete questions.

Do not add charts or metric cards merely to occupy space.

Each metric must include:

- Clear label
- Time range
- Unit
- Comparison context where useful
- Action or interpretation where relevant

## 12.5 Marketplace discipline

Marketplace cards should prioritize:

1. Item identity
2. Price
3. Condition or key differentiator
4. Location or delivery information where relevant
5. Trust or seller information
6. Clear next action

Avoid decorative banners that consume more space than the products themselves.

---

# 13. Dialogs, sheets, overlays, and menus

## 13.1 Use the correct container

Use a dialog when the task is brief and focused.

Use a side panel when context must remain visible.

Use a bottom sheet for mobile actions or short forms.

Use a full screen when the task is complex, multi-step, keyboard-heavy, or content-rich.

## 13.2 Avoid modal stacking

Do not open a dialog from a dialog unless there is no practical alternative.

## 13.3 Dismissal must be predictable

Define:

- Close button behavior
- Escape key behavior
- Back button behavior
- Outside-click behavior
- Unsaved change behavior

## 13.4 Background treatment

Use a simple scrim.

Do not add excessive blur, glow, gradient, or animated particles behind a dialog.

---

# 14. Motion and micro-interactions

## 14.1 Motion must explain change

Use animation to show:

- Entrance or exit
- Spatial relationship
- State change
- Progress
- Confirmation
- Reordering

Do not animate elements continuously for decoration.

## 14.2 Keep motion brief

Typical durations:

- Micro feedback: `100–180ms`
- Component transition: `180–260ms`
- Page or panel transition: `220–350ms`

Longer animation requires a specific reason.

## 14.3 Respect reduced motion

All non-essential motion must support reduced-motion preferences.

## 14.4 Avoid motion clutter

Do not animate several unrelated elements at the same time.

---

# 15. Accessibility and inclusive design

Every interface must support:

- Keyboard navigation
- Visible focus states
- Screen-reader labels
- Logical reading order
- Sufficient contrast
- Adequate touch targets
- Text resizing
- Reduced motion
- Color-independent status communication
- Clear error recovery

Do not treat accessibility as a final audit. It must influence component design from the beginning.

---

# 16. Required states

Every interactive feature must account for the relevant states below.

## Data states

- Initial
- Loading
- Loaded
- Empty
- Partial
- Stale
- Refreshing
- Error
- Offline

## Control states

- Default
- Hover
- Focus
- Active
- Selected
- Disabled
- Read-only
- Validation error
- Success

## Permission states

- Permission not requested
- Permission granted
- Permission denied
- Permission permanently denied
- Permission revoked

## Transaction states

- Idle
- In progress
- Succeeded
- Failed
- Retry available
- Cancelled

Do not ship only the ideal state.

---

# 17. Implementation rules

## 17.1 Use tokens, not magic values

Colors, spacing, radius, typography, elevation, and motion must come from centralized tokens.

Do not scatter arbitrary values throughout the codebase.

## 17.2 Use semantic components

Component names should describe purpose, not appearance.

Prefer:

- `ProductCard`
- `SearchField`
- `AccountSwitcher`
- `EmptyState`
- `CheckoutSummary`

Avoid:

- `BlueBox`
- `FancyCard`
- `GlowButton`
- `RoundedContainer2`

## 17.3 Avoid absolute positioning for layout

Use flexbox, grid, constraints, stacks, or native layout systems.

Absolute positioning is allowed for overlays, badges, anchored popovers, and deliberate layered composition—not for normal page structure.

## 17.4 Preserve responsiveness

Components must be tested at minimum and maximum supported widths.

Do not hardcode a screenshot width.

## 17.5 Separate content from presentation

Do not embed placeholder copy directly inside reusable visual components.

## 17.6 Avoid dependency-driven design

Do not shape the interface around whatever components happen to exist in a UI library.

Choose the correct interaction first, then implement it with the library or custom code.

## 17.7 Remove dead decoration

Before completion, delete:

- Decorative wrappers with no function
- Duplicate borders
- Duplicate shadows
- Empty headings
- Redundant icons
- Repeated labels
- Unused badges
- Placeholder statistics
- Background effects that do not support the task

---

# 18. Anti-slop scorecard

Score each category from `0` to `2`.

- `0` = failed
- `1` = acceptable but weak
- `2` = strong

## Product fit

- The interface is clearly designed for this specific product.
- Domain language and workflows are accurate.
- The screen does not resemble a generic template with replaced labels.

## Hierarchy

- The primary task is obvious.
- Headings, actions, and content have distinct visual weights.
- The hierarchy works without relying on accent color.

## Layout

- Alignment is consistent.
- Spacing follows a clear system.
- Containers are used only where needed.

## Typography

- Text is readable at normal viewing distance.
- The type scale is controlled.
- Supporting text is not excessively faint or small.

## Interaction

- Controls use familiar patterns.
- Important actions are labeled clearly.
- Navigation and back behavior are predictable.

## Content

- Copy is specific and useful.
- Realistic content lengths were tested.
- No filler metrics, badges, or sections were added.

## Visual restraint

- Effects are limited and justified.
- Cards, pills, gradients, glows, and shadows are not overused.
- The interface remains coherent without decoration.

## Accessibility

- Contrast, focus, touch targets, labels, and reading order are handled.
- Status is not communicated by color alone.

## States

- Loading, empty, error, disabled, and success states exist where required.

## Implementation

- Tokens and reusable components are used.
- No screenshot-specific hacks or arbitrary positioning are present.

**Minimum passing score: 17/20.**

Any category scored `0` must be fixed even when the total score passes.

---

# 19. Automatic rejection triggers

The agent must stop and revise the design when any of the following occurs:

- More than one prominent primary action appears in the same context.
- The same screen contains excessive card nesting.
- Body text is too small to read comfortably.
- A floating action button overlaps or competes with navigation.
- Navigation contains more destinations than the chosen pattern can support.
- The screen uses gradients, glows, blur, and glass effects simultaneously.
- The screen is visually dependent on a large decorative hero that contributes little to the main task.
- The mobile screen uses a small centered desktop-style modal for a complex form.
- Several controls are represented by ambiguous icons without labels.
- Spacing values are inconsistent without a clear reason.
- The design has no empty or error state.
- The interface looks plausible only with perfect placeholder content.
- The implementation relies on absolute positioning to preserve the layout.
- A UI library's default components determine the product structure.
- The agent cannot explain why a major visual element exists.

---

# 20. Banned default habits

The following are not permanently forbidden, but they are forbidden as defaults:

- Gradient primary buttons
- Neon blue or purple glow
- Glassmorphism panels
- Huge rounded corners everywhere
- Pill-shaped controls everywhere
- Dark navy background for every product
- Generic dashboard metric cards
- Oversized welcome banners
- Decorative orbiting shapes
- Random sparkles
- Floating action button on every mobile screen
- Three-column feature cards
- Icon inside every heading
- Badge on every item
- Repeated "AI-powered" labels
- Generic stock illustrations
- Tiny gray helper text
- Placeholder charts
- Repeated shadows
- Excessive blur
- Animated background blobs
- Multiple accent colors without semantic meaning
- Unnecessary sidebars
- Centered layouts for dense productivity work
- Full-width layouts for long-form text

Any use of these patterns must be justified by product requirements.

---

# 21. Platform-specific standards

## Mobile

- Design for one-handed use where appropriate.
- Respect safe areas, status bars, gesture areas, and keyboards.
- Keep primary actions reachable.
- Avoid cramped modal dialogs.
- Use bottom navigation only for top-level destinations.
- Do not place a floating action button directly over a bottom-navigation item.
- Ensure scrolling content is not hidden behind fixed bars.
- Test at small viewport heights, not only narrow widths.

## Desktop web

- Use available width intentionally.
- Do not stretch mobile cards across the screen.
- Support keyboard navigation and hover states.
- Use tables for structured comparison when appropriate.
- Keep dense workflows efficient.
- Maintain readable line lengths.
- Use sidebars only when persistent navigation or tools justify them.

## Tablet

- Do not treat tablet as a large phone.
- Consider split views, master-detail layouts, adaptable panels, and landscape use.

## Native desktop

- Respect window resizing, menus, shortcuts, drag-and-drop, file behavior, multiple windows, and platform conventions.

---

# 22. Product-specific visual identity

A product should not depend on trendy effects to feel unique.

Build identity through:

- Distinctive but controlled typography
- Product-specific content structure
- Meaningful iconography
- Purposeful motion
- Consistent illustration or photography direction
- Domain-aware interaction patterns
- Deliberate tone of voice
- A restrained, recognizable accent system

The interface should still feel like the same product when effects are removed.

---

# 23. Content and copy rules

- Use concrete language.
- Prefer verbs that describe results.
- Avoid hype.
- Avoid filler headings.
- Avoid repeating information already visible in the interface.
- Keep descriptions proportional to their importance.
- Do not fabricate testimonials, users, statistics, transaction history, rankings, or trust signals.
- Use realistic placeholder data and clearly mark it as sample data when required.
- Match terminology throughout the product.

---

# 24. Final delivery contract

Before declaring a UI task complete, the agent must provide or verify:

1. The primary user task for each screen
2. The screen flow
3. The design tokens
4. Responsive behavior
5. Component states
6. Loading, empty, error, and success states
7. Accessibility behavior
8. Anti-slop score
9. Any assumptions made
10. Any known limitations

The agent must not describe a design as "modern," "clean," "premium," "beautiful," "world-class," or "intuitive" unless the claim is supported by specific design decisions.

---

# 25. Final pre-ship checklist

Before shipping, confirm all answers are **yes**:

- Is the primary task obvious within three seconds?
- Does the screen feel specific to the product rather than template-generated?
- Can any card, badge, icon, shadow, gradient, or wrapper be removed without losing meaning?
- Is there only one dominant action per context?
- Is body text comfortably readable?
- Are spacing and alignment systematic?
- Are navigation and back behavior predictable?
- Are touch targets and focus states adequate?
- Does the design work with realistic long and short content?
- Does it work at the smallest supported viewport?
- Does it work at the largest supported viewport?
- Are loading, empty, error, disabled, and success states implemented?
- Are colors semantic and accessible?
- Are effects limited and justified?
- Are components reusable and token-driven?
- Is the implementation free of screenshot-specific hacks?
- Could a real user complete the task without explanation?

When any answer is **no**, continue refining. Do not ship.

---

# 26. Instruction to the agent

Treat this document as a standing constraint for every future UI task.

Do not optimize for instant visual impact at the expense of usability.

Do not imitate common AI-generated interface patterns.

Do not add decorative complexity to compensate for weak product structure.

Design the workflow first, then the interface, then the visual character.

Every design decision must be explainable in terms of user need, product logic, platform convention, accessibility, or brand intent.
