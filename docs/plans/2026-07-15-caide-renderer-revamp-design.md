# CAIDE Renderer Revamp Design

## Objective

Turn the combined desktop application into a mobile app builder that looks and feels like CAIDE while retaining Dyad's generation runtime, Electron main process, IPC, SQLite, Git, preview, provider, and packaging infrastructure.

## Product Boundary

- Every user-facing surface is CAIDE.
- Dyad names remain only in internal compatibility identifiers such as IPC channels, parser tags, protocols, persisted paths, and backend types.
- The original CAIDE backend is not imported.
- New backend contracts may be added inside the combined application only when the existing Dyad runtime has no mobile-specific equivalent.
- AI generation and code-editing behavior continue to use Dyad's existing pipeline.

## Information Architecture

### Project Overview

The default route is a CAIDE project workspace with:

- project creation from a mobile product brief;
- recent projects and project search;
- Figma import, backup import, trash, and settings entry points;
- provider/model selection without subscription messaging;
- mobile-specific starter briefs and project statistics.

### Mobile Canvas

Opening a project enters a dense mobile-builder canvas with:

- a CAIDE brand rail and project toolbar;
- a screen map and mobile project resources;
- inspect, edit, flow-test, and pan modes;
- device, zoom, and preview-state controls;
- a live preview framed as the selected phone or tablet;
- a bottom AI composer connected to Dyad chat streaming;
- a contextual properties inspector;
- test, share, and release actions.

### Settings

Settings expose providers, local runtime controls, integrations, and application preferences under CAIDE terminology. There is no paid plan, subscription, quota upsell, Pro badge, or feature gate.

## AI And Provider Model

All CAIDE build and agent modes are unlocked. Users connect their own supported provider credentials. Paid Dyad entitlement UI and renderer control paths are removed; internal compatibility code may remain dormant where deleting it would change backend behavior.

## Adapter Strategy

The renderer uses a narrow CAIDE adapter over existing typed Dyad IPC. Project creation maps to app creation plus chat creation. Brief submission and canvas edits map to the existing stream-message pipeline. Project history, Git, preview, tests, and settings retain their existing handlers. Mobile screen metadata is derived from available project and preview information, with new typed IPC added only if renderer-side derivation is insufficient.

## Verification

- Production renderer and worker type checks pass.
- React Doctor reports no new high-confidence errors introduced by the revamp.
- Electron screenshots at overview and canvas sizes match the supplied CAIDE references in structure and density.
- Automated DOM checks find no user-facing `Dyad`, `Dyad Pro`, subscription, upgrade, or paid-plan text in the main CAIDE routes.
- New-project, project-open, AI-submit, device selection, screen selection, settings, and canvas-mode interactions work.
- The packaged Electron application launches successfully.
