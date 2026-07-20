# Project Details Page Redesign

## Goal

Make the project details route fully scrollable and turn it into a clear project operations surface rather than one long generic card.

## Layout

- The route owns vertical scrolling inside the fixed Electron viewport.
- A sticky top bar keeps Back and the primary Open in Chat action available.
- Desktop uses two columns: preview and project identity on the left; project actions and integrations on the right.
- Narrow windows collapse to a single column without horizontal overflow.
- GitHub, database providers, native builds, and upgrades remain separate operational sections.

## Behavior

- Existing connector and dialog components keep their current data flow and IPC behavior.
- Preview, rename, favorite, collection, folder, copy, move, delete, and chat actions remain available.
- The final content receives bottom safe space so every control can be scrolled above the viewport edge.

## Verification

- Type-check the renderer and run focused tests.
- Run React Doctor on the changed React surface.
- Capture desktop and narrow-window screenshots and verify that the route scrolls to its final section.
- Build Linux AppImage and Windows installer artifacts.
