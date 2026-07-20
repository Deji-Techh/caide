# CAIDE Notch — Dynamic Island-Style Floating Window

## Overview

A persistent, always-on-top floating "notch" window inspired by the macOS notch and iPhone Dynamic Island. Lives at the top center of the screen, stays visible even when CAIDE is minimized, and provides glanceable AI progress, notifications, and a mini chat input.

## Architecture

The notch is a second Electron BrowserWindow with its own lightweight React tree (separate Vite entry). It follows the same pattern as the project's worker entries.

```
Main Process
├── Main Window (React, full app)
└── Notch Window (React mini, alwaysOnTop)
    ├── Receives broadcast events from main process
    └── Sends commands via existing IPC contracts
```

## Window Configuration

- **Type:** Secondary `BrowserWindow`
- **Frame:** `false` (frameless, custom rounded pill shape)
- **Transparent:** `true` (glassmorphism background)
- **Always-on-top:** `true`
- **Skip taskbar:** `true` (not in dock/taskbar)
- **Resizable:** `false`
- **Focusable:** `false` (doesn't steal focus from active app)
- **macOS level:** `panel` (floats above fullscreen apps)

## Positioning

Top-center of the primary display, flush with the top edge:

```typescript
const workArea = screen.getPrimaryDisplay().workArea;
notchWindow.setPosition(
  workArea.x + (workArea.width - currentWidth) / 2,
  workArea.y,
);
```

## States & Dimensions

| State            | Width | Height | Trigger                          |
| ---------------- | ----- | ------ | -------------------------------- |
| Collapsed        | 180px | 36px   | Default idle state               |
| Streaming        | 320px | 48px   | AI streaming in progress         |
| Notification     | 280px | 44px   | File changes, build complete     |
| Expanded (hover) | 400px | 240px  | Hover or manual click            |
| Expanded (event) | 400px | 240px  | Auto-expands on important events |

## IPC Contracts

### Events (main → notch)

| Channel                 | Payload                                | Purpose              |
| ----------------------- | -------------------------------------- | -------------------- |
| `notch:stream-progress` | `{ chatId, status, model?, message? }` | AI stream status     |
| `notch:app-change`      | `{ appName, changeCount, type }`       | File/build changes   |
| `notch:notification`    | `{ title, body, type, action? }`       | System notifications |
| `notch:chat-complete`   | `{ chatId, summary? }`                 | Response finished    |

### Commands (notch → main)

| Channel               | Implementation                | Purpose                |
| --------------------- | ----------------------------- | ---------------------- |
| `chat:stream`         | Existing chat stream contract | Send prompt from notch |
| `system:focus-window` | Existing handler              | Focus main app         |
| `notch:dismiss`       | New handler                   | Dismiss notification   |

## UI Components

```
<NotchApp>
  <NotchWindow>              ← framer-motion container
    <NotchStatusBar>         ← Collapsed state
      <NotchLogo />
      <StatusIndicator />
    </NotchStatusBar>
    <NotchPanel>             ← Expanded state (AnimatePresence)
      <NotchHeader>
        <StatusRow />
        <NotificationBadge />
      </NotchHeader>
      <NotchChatInput />
      <NotchRecentList />
    </NotchPanel>
  </NotchWindow>
</NotchApp>
```

## Animations

Using framer-motion spring physics matching iOS Dynamic Island quality:

- `spring({ mass: 0.8, tension: 200, friction: 20 })` for size changes
- `layoutAnimation` for smooth width/height transitions
- `AnimatePresence` for enter/exit of notifications and panels
- Respects `prefers-reduced-motion`

## Build Configuration

New Vite entries in `forge.config.ts`:

- `src/notch/notch.ts` (main process entry — creates the notch window)
- `src/notch/preload.ts` (notch preload with subset of channels)
- Renderer: `notch` renderer entry with its own Vite config

New files:

```
src/
├── notch/
│   ├── notch.ts
│   ├── preload.ts
│   ├── notch.html
│   ├── App.tsx
│   ├── components/
│   │   ├── NotchWindow.tsx
│   │   ├── NotchStatusBar.tsx
│   │   ├── NotchPanel.tsx
│   │   ├── NotchChatInput.tsx
│   │   ├── NotchRecentList.tsx
│   │   └── StatusIndicator.tsx
│   └── hooks/
│       └── useNotchEvents.ts
├── ipc/types/notch.ts
```

## Modifications to existing files

- `src/main.ts` — Create notch window after main window, wire up lifecycle
- `src/ipc/ipc_host.ts` — Register notch handler
- `src/ipc/preload/channels.ts` — Add notch channels to whitelist
- `forge.config.ts` — Add Vite entries for notch
- `vite.notch.config.mts` (new) — Vite config for notch main entry
- `vite.notch-renderer.config.mts` (new) — Vite config for notch renderer

## Testing

- Unit tests for notch IPC contracts
- Integration tests for event broadcasting and consumption
- E2E tests verifying notch window creation, positioning, expand/collapse
