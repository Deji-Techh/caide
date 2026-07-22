# Expanded UI/UX Quality Rubric

Use this rubric during self-review, team critique, acceptance, or redesign prioritization. Score each dimension from 0 to 10 and record evidence.

## Scoring Meaning

| Score | Meaning                                            |
| ----: | -------------------------------------------------- |
|   0–2 | absent or fundamentally broken                     |
|   3–4 | major deficiencies                                 |
|   5–6 | functional but ordinary or incomplete              |
|     7 | solid with identifiable improvements               |
|     8 | strong production quality                          |
|     9 | exceptional and thoroughly resolved                |
|    10 | exemplary; no material issue found in tested scope |

A score of 10 should be rare and evidence-based.

---

## 1. Product Fit

Evaluate:

- product archetype reflected in density and patterns;
- user expertise supported;
- emotional context respected;
- domain-specific trust and risk handled;
- visual system expresses product identity;
- no inappropriate pattern imported from unrelated products.

**Failure examples:** consumer card layout for a dense operations tool; playful motion in an urgent clinical flow.

---

## 2. Primary-Task Clarity

Evaluate:

- users know where they are;
- primary task is visually and verbally clear;
- required information appears before action;
- next step is obvious;
- competing actions are controlled;
- five-second test passes.

---

## 3. Information Architecture

Evaluate:

- object model is coherent;
- navigation matches user mental model;
- labels are distinct;
- depth is reasonable;
- location and return paths are clear;
- search, browse, and filters match collection size;
- permissions do not create unexplained gaps.

---

## 4. Flow Quality

Evaluate:

- unnecessary steps removed;
- context and data preserved;
- interruptions handled;
- decision points are meaningful;
- success is explicit;
- failure and recovery are complete;
- high-risk actions include review or reversibility.

---

## 5. Content Quality

Evaluate:

- realistic data;
- specific headings and labels;
- action-oriented controls;
- useful help;
- clear errors;
- correct units and formats;
- no fabricated proof or claims;
- tone appropriate to audience and situation.

---

## 6. Visual Hierarchy

Evaluate:

- dominant focal point;
- clear reading and scan path;
- primary, secondary, and tertiary distinction;
- spacing expresses relationships;
- containers are purposeful;
- hierarchy survives grayscale and blur tests;
- no excessive equal-emphasis elements.

---

## 7. Design-System Coherence

Evaluate:

- semantic tokens;
- consistent type roles;
- spacing scale;
- coherent radii and elevation;
- shared component behavior;
- controlled variants;
- theme quality;
- density strategy;
- documentation and governance where scope requires.

---

## 8. Interaction Quality

Evaluate:

- affordance;
- hover, focus, pressed, selected, disabled, and loading states;
- immediate feedback;
- spatial continuity;
- keyboard and touch behavior;
- interruption and cancellation;
- no accidental destructive behavior;
- no hidden critical controls.

---

## 9. State Coverage

Evaluate relevant states:

- first-time;
- loading;
- empty;
- filtered empty;
- error;
- partial error;
- offline;
- permission denied;
- session expired;
- unsaved;
- success;
- undo;
- long content;
- extreme data;
- responsive constraints.

A beautiful default state with no resilience should score poorly.

---

## 10. Accessibility

Evaluate:

- semantics;
- names and labels;
- keyboard completion;
- focus visibility and non-obscuring;
- contrast;
- target size;
- zoom and text scaling;
- reduced motion;
- color independence;
- error handling;
- accessible authentication;
- screen-reader testing.

Known blockers cap the overall design rating regardless of visual quality.

---

## 11. Responsive Quality

Evaluate:

- intentional transformation;
- no content loss;
- navigation adaptation;
- table and chart strategy;
- safe areas;
- virtual keyboard;
- touch ergonomics;
- tablet and wide-screen use;
- text expansion;
- orientation and resize preservation.

---

## 12. Performance and Reliability

Evaluate:

- fast initial comprehension;
- stable layout;
- appropriate loading feedback;
- optimized media and fonts;
- reasonable JavaScript cost;
- large-data strategy;
- failure recovery;
- cancellation;
- stale-data visibility;
- no false progress.

---

## 13. Distinctiveness

Evaluate:

- product-specific layout;
- coherent visual concept;
- realistic domain content;
- useful signature idea;
- absence of generic AI trends;
- originality without imitation;
- brand consistency.

Distinctiveness should not reduce usability.

---

## 14. Implementation Feasibility

Evaluate:

- selected stack can support behavior;
- component boundaries are maintainable;
- backend dependencies are known;
- responsive behavior is implementable;
- states map to data contracts;
- performance risks are addressed;
- tests are possible;
- migration risk is controlled.

---

## 15. Trust and Ethics

Evaluate:

- data requests are justified;
- consent is clear;
- fees and consequences are visible;
- no dark patterns;
- sensitive data is protected;
- status and provenance are transparent;
- generated or uncertain content is identified;
- cancellation and deletion are fair.

---

## Weighted Score

Recommended weighting:

| Dimension                | Weight |
| ------------------------ | -----: |
| Product fit              |    10% |
| Primary-task clarity     |    10% |
| Information architecture |     8% |
| Flow quality             |     8% |
| Content                  |     6% |
| Visual hierarchy         |     8% |
| Design system            |     6% |
| Interaction              |     8% |
| State coverage           |     8% |
| Accessibility            |    10% |
| Responsive quality       |     6% |
| Performance              |     4% |
| Distinctiveness          |     4% |
| Feasibility              |     2% |
| Trust and ethics         |     2% |

Do not use the weighted score to hide a blocker. A blocker remains a blocker.

---

## Acceptance Decision

- **Reject:** accessibility blocker, unsafe behavior, critical broken flow, deceptive design, or score below 6 in product fit/task clarity.
- **Revise:** no blockers but one or more required dimensions below threshold.
- **Accept with follow-up:** production-safe, minor issues documented.
- **Accept:** all mandatory thresholds met and evidence recorded.
