# CAIDE Mobile UI Quality Gate

## Problem

Generated apps can satisfy a feature request while still rendering poorly inside CAIDE's device preview. The calculator example created a fixed 390 by 780 simulated phone, complete with its own status bar and border, inside CAIDE's Samsung frame. This caused nested device chrome, clipping, double scrolling, and a weak generic visual result. The starter scaffold also exposed a `Made with Dyad` badge.

## Direction

CAIDE will treat the selected device frame as the only device chrome. Generated application roots must fill the available viewport, use responsive constraints, and adapt their content at semantic breakpoints. Generated UI must establish a product-specific visual direction and reusable semantic tokens before composing screens.

## Skill Pack

An always-on mobile UI skill pack will combine the useful rules from CAIDE's `mobile-ui`, `responsive-mobile-layout`, `mobile-design-system`, accessibility, performance, forms, and navigation skills. The system will inject the skill pack into every build/edit prompt so it applies regardless of model or agent mode.

Core rules:

- Never render a fake phone, tablet, browser, notch, status bar, home indicator, or device border inside the app.
- Never use fixed phone-sized root canvases or fixed-height content shells.
- Use `min-height: 100dvh`, safe-area insets, fluid width, and one intentional vertical scroll owner.
- Verify compact phone, large phone, foldable, tablet, portrait, and landscape behavior.
- Use semantic design tokens, finite component variants, accessible contrast, 44px touch targets, and visible interaction states.
- Avoid generic template composition, decorative gradients, nested cards, fake metrics, and controls that do not work.

## Validation

A deterministic source quality scanner will inspect changed frontend files for high-confidence violations such as device-shell language combined with fixed phone dimensions, root horizontal overflow, legacy Dyad branding, and fixed viewport containers. The result will be added to the agent's completion requirements so the agent repairs violations before finishing. The scaffold and project rules will carry the same contract for new and existing apps.

## Existing Project Repair

The current calculator will be converted from a simulated phone mockup into a responsive full-viewport application. It will retain working calculator, converter, tip, history, theme, and sound behavior while improving hierarchy, spacing, keypad ergonomics, landscape/tablet adaptation, and accessibility. The obsolete Dyad badge component and references will be removed.

## Verification

- Prompt snapshots and quality-scanner unit tests.
- TypeScript, lint, and targeted regression tests.
- Generated calculator production build.
- Playwright screenshots and interaction checks through CAIDE's proxy at compact phone, large phone, landscape, and tablet sizes.
- Source audit confirming no visible Dyad branding or nested device shell remains.
