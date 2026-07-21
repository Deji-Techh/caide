---
name: motion-interaction
description: Apply whenever building or editing interactive UI. Enforces purposeful motion, complete control states, input ergonomics, reduced-motion support, and stable layouts.
---

# Motion and Interaction Contract

## Required workflow

1. Identify state changes: navigation, reveal, submit, drag, resize, loading, success, failure, and recovery.
2. Choose motion only when it explains continuity, confirms input, or directs attention.
3. Implement every control state: default, hover where available, pressed, keyboard focus, disabled, loading, success, and error where relevant.
4. Verify mouse, keyboard, and touch paths. Do not depend on hover or gestures alone.
5. Test with reduced motion enabled and with rapid repeated input.

## Motion rules

- Use `transform` and `opacity` for animation whenever possible.
- Keep control feedback around 100-180ms and view transitions around 180-320ms.
- Enter with ease-out, exit with ease-in, and move within a view with ease-in-out.
- Preserve stable dimensions during loading and state changes. Labels, icons, and dynamic content must not shift adjacent layout.
- Never use looping decorative motion, scroll hijacking, or animation that delays task completion.
- Respect `prefers-reduced-motion`; replace spatial motion with an instant state change or short fade.

## Interaction rules

- Touch targets are at least 44x44 CSS pixels where the platform permits.
- Icon-only controls require an accessible name and a tooltip when meaning is not universal.
- Focus order follows visual order. Dialogs trap focus, close with Escape, and restore focus to the trigger.
- Every asynchronous action gives immediate feedback, prevents accidental duplication, and provides a recoverable error state.
- Drag and resize interactions have keyboard or direct-input alternatives when they are required to complete a task.

## Completion gate

Do not call the interaction complete until layout remains stable, all states are visible and operable, reduced motion works, and primary flows succeed with keyboard and touch input.
