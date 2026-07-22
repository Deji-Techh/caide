# Anti-Slop and Distinctiveness Reference

“AI slop” in interface design is output that appears polished at first glance but is generic, repetitive, semantically weak, and disconnected from the product. This reference helps detect and repair it.

## 1. Root Causes

Generic output usually results from:

- styling before understanding tasks;
- overfitting to common portfolio screenshots;
- using components as decoration;
- avoiding real content and edge cases;
- applying one visual trend to every domain;
- optimizing only the first viewport;
- no critique or revision loop;
- no implementation constraints.

Repair the cause, not only the visual symptom.

---

## 2. Generic Layout Signatures

Flag these when used without a product reason:

- sidebar, four KPI cards, full-width chart, recent activity table;
- giant centered hero, gradient heading, two CTAs, dashboard mockup;
- bento grid where card sizes do not encode importance;
- three feature cards with identical structure;
- pricing cards with one exaggerated “popular” plan and unclear differences;
- every section isolated in a rounded rectangle;
- desktop page composed only of full-width stacked sections;
- mobile screen with a header, giant greeting, cards, and floating action button regardless of task.

### Correction

Rebuild from object model, task frequency, and information hierarchy. Choose layout regions based on what users compare, manipulate, monitor, or read.

---

## 3. Generic Visual Signatures

Flag:

- blue-purple gradient identity;
- gradient text;
- glass panels;
- blurred orbs;
- excessive pills;
- uniform 20px radii;
- shadows on every surface;
- random neon accents on dark backgrounds;
- decorative grids or stars unrelated to brand;
- excessive line icons beside headings;
- low-contrast gray text presented as sophisticated;
- huge whitespace in professional tools where users need density.

### Correction

Define a visual concept in one sentence and derive typography, geometry, surface, color, iconography, and motion from it. Remove any treatment that cannot be explained through product, brand, hierarchy, or interaction.

---

## 4. Generic Copy Signatures

Flag:

- “Unlock the power of…”;
- “Revolutionize your…”;
- “Seamlessly…”;
- “All-in-one solution”;
- “Built for the future”;
- “Supercharge your workflow”;
- “Transform the way you…”;
- headings that make claims without naming capability or outcome;
- placeholder testimonials and metrics;
- vague buttons such as “Get Started” when a specific action exists.

### Correction

Use concrete nouns, verbs, audiences, constraints, and outcomes. Replace claims with evidence or product demonstration.

---

## 5. Generic Component Use

Flag:

- badges for ordinary metadata;
- tooltips compensating for unlabeled primary controls;
- cards wrapping one line of content;
- accordions used to hide necessary information;
- modals used for ordinary navigation;
- carousels used to reduce page length;
- tabs used for unrelated destinations;
- a skeleton state that does not match final layout;
- charts used when a number or table would answer the question better.

### Correction

Choose components from interaction need, not aesthetic variety.

---

## 6. Product-Specificity Questions

Before finalizing, answer:

1. Which layout decision came directly from the primary task?
2. Which visual decision expresses the product's identity?
3. Which pattern supports the user's expertise level?
4. Which state protects users from domain-specific risk?
5. Which content fields are unique to this product?
6. What would break if this interface were repurposed for another domain?
7. What useful detail would a generic template omit?

If answers are weak, the design remains generic.

---

## 7. Signature Idea Rule

Each substantial product should contain one or more signature ideas that are:

- useful;
- repeatable;
- tied to the product;
- understandable;
- implementable;
- not merely decorative.

Examples:

- a creator tool's object lineage visualization;
- a finance product's transparent fee and settlement timeline;
- an IDE's context map showing what the agent can access;
- a healthcare app's provenance treatment for each measurement;
- a marketplace's comparison tray tailored to category attributes.

Do not force a signature interaction into every screen.

---

## 8. Variation Without Chaos

Distinctiveness does not require inconsistent components. Create variation through:

- composition;
- content scale;
- density;
- image treatment;
- typography;
- controlled asymmetry;
- section rhythm;
- meaningful emphasis;
- domain-specific visualization.

Keep controls and behavior consistent.

---

## 9. Anti-Slop Review Pass

For every screen:

- circle every card; remove containers that do not create meaningful grouping;
- identify every accent color; remove accents without semantic or hierarchical purpose;
- inspect every icon; add labels or remove decorative icons;
- replace filler content with realistic values;
- remove duplicated headings and descriptions;
- reduce radius variety;
- verify the primary action is not competing with multiple equal buttons;
- test whether the layout still communicates without gradients and shadows;
- inspect empty, error, loading, and long-content states;
- compare against the product archetype.

---

## 10. Distinctiveness Score

Score each 0–2:

| Criterion           | 0                | 1                   | 2                          |
| ------------------- | ---------------- | ------------------- | -------------------------- |
| Product specificity | interchangeable  | partially adapted   | unmistakably fitted        |
| Content realism     | filler           | plausible           | domain-authentic           |
| Visual concept      | trend collage    | somewhat coherent   | coherent and ownable       |
| Interaction idea    | generic controls | one adapted pattern | useful signature system    |
| Layout logic        | template         | mixed               | task-derived               |
| State design        | happy path       | common states       | domain-specific resilience |

A total below 9/12 requires revision.
