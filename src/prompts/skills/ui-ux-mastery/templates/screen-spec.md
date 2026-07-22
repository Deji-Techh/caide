# Screen Specification Template

# Screen: [Screen name]

## 1. Purpose

Describe the single primary outcome this screen enables.

## 2. Primary User

- Role:
- Expertise:
- Frequency of use:
- Environment/device:
- Important constraints:

## 3. Entry Context

- Entry points:
- Preconditions:
- Data already known:
- Previous user state that must be preserved:

## 4. Success Definition

The screen succeeds when:

- [ ]
- [ ]
- [ ]

## 5. Primary and Secondary Actions

### Primary action

- Label:
- Preconditions:
- Result:
- Failure behavior:

### Secondary actions

| Action | Priority | Result | Safeguard |
| ------ | -------- | ------ | --------- |
|        |          |        |           |

## 6. Information Hierarchy

1. Primary context:
2. Decision-critical information:
3. Supporting information:
4. Tertiary metadata:
5. Help or recovery:

## 7. Layout Regions

| Region | Purpose | Persistent? | Responsive transformation |
| ------ | ------- | ----------: | ------------------------- |
|        |         |             |                           |

## 8. Components

| Component | Variant | Content | Important behavior |
| --------- | ------- | ------- | ------------------ |
|           |         |         |                    |

## 9. Interaction Sequence

1.
2.
3.

## 10. State Matrix

| State             | Trigger | Visible result | Available action | Accessibility announcement |
| ----------------- | ------- | -------------- | ---------------- | -------------------------- |
| Initial           |         |                |                  |                            |
| Loading           |         |                |                  |                            |
| Empty             |         |                |                  |                            |
| Error             |         |                |                  |                            |
| Success           |         |                |                  |                            |
| Permission denied |         |                |                  |                            |
| Offline           |         |                |                  |                            |

Delete irrelevant rows and add domain-specific states.

## 11. Validation and Error Recovery

- Validation timing:
- Field errors:
- Page-level errors:
- Preserved data:
- Retry path:
- Support path:

## 12. Responsive Behavior

### Narrow mobile

- layout:
- navigation:
- action placement:
- overflow:
- virtual keyboard:

### Tablet

- layout:
- panel behavior:

### Desktop

- layout:
- density:
- keyboard acceleration:

### Wide desktop

- maximum width or additional regions:

## 13. Accessibility

- page title and H1:
- landmarks:
- focus entry:
- tab order:
- keyboard interactions:
- screen-reader names and descriptions:
- live regions:
- contrast considerations:
- zoom/text scaling:
- reduced motion:
- target size:

## 14. Content Rules

- heading:
- labels:
- helper text:
- empty state:
- error language:
- units and formats:
- localization risks:

## 15. Analytics and Audit Events

| Event | Trigger | Properties | Privacy note |
| ----- | ------- | ---------- | ------------ |
|       |         |            |              |

## 16. Technical Dependencies

- data source:
- endpoint or query:
- permission:
- persistence:
- background task:
- external service:

## 17. Acceptance Criteria

- [ ] Primary task is obvious.
- [ ] Required states are implemented.
- [ ] Keyboard flow is complete.
- [ ] Responsive transformations are verified.
- [ ] Content handles realistic extremes.
- [ ] Errors preserve user work.
- [ ] Analytics do not expose sensitive content.
- [ ] Build and tests pass.
