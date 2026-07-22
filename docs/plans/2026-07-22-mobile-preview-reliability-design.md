# Mobile Preview Reliability Design

## Problem

Enabling mobile preview restarts the preview proxy on `0.0.0.0`, but the IPC
handler returns before the worker reports that it is listening. The renderer
receives `null`, marks the feature enabled, and never creates or opens the QR
code. A later URL conversion also fails for `0.0.0.0`, and network-interface
ordering can select a VPN address instead of the local Wi-Fi or Ethernet
address.

## Architecture

- Make proxy readiness an explicit promise stored with each running app.
- Make `ensureProxyForRunningApp` resolve to the ready, browser-safe proxy URL.
- Reuse and await the same readiness promise for concurrent calls with the same
  proxy configuration.
- Bind the worker to `0.0.0.0` for phone access while continuing to advertise
  `localhost` to CAIDE's desktop iframe, preserving its origin and browser state.
- Reject readiness on bind errors, worker errors, premature exits, or timeout.
- Rank ordinary private IPv4 LAN addresses ahead of VPN, container, and virtual
  interfaces.

## UI Flow

- Use one shared hook for both mobile-preview toolbar implementations.
- Open the popover immediately and show a stable loading state.
- Enable state is committed only after the proxy and QR data URL are ready.
- Construct the phone URL with the `URL` API by replacing the hostname while
  preserving protocol, port, path, query, and fragment.
- On failure, restore the localhost proxy, clear QR state, close the popover,
  and show a specific error.
- Disable waits for localhost restoration before clearing the enabled state.
- Prevent overlapping enable/disable requests and reset stale state when the
  selected app changes.

## Verification

- Unit tests cover readiness, concurrent reuse, bind failure, timeout, and
  localhost URL normalization.
- Network-address tests cover physical LAN preference and virtual-interface
  fallback.
- Hook tests cover enable, disable, rollback, and URL conversion.
- Packaged Playwright verification checks loading, visible QR output, a usable
  LAN URL, desktop iframe continuity, disable, and re-enable.

## Release

Ship as CAIDE Mobile Builder `0.1.2`, rebuild Linux AppImage and Windows Setup,
validate artifact formats and checksums, then commit and push to `origin/main`.
