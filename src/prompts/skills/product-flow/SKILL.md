---
name: product-flow
description: Apply to every app build and feature edit. Ensures complete cross-screen journeys, navigation, state coverage, clear recovery, and realistic product behavior rather than isolated mock screens.
---

# Product Flow Contract

## Model the journey first

For each requested feature, identify the actor, entry point, prerequisite, primary action, success destination, alternate path, failure path, and way back. Implement the entire reachable journey, not only the first screen.

## Mandatory state coverage

Every data-driven surface needs appropriate loading, empty, populated, partial, offline, permission-denied, error, and retry states. Mutations need pending, success, failure, duplicate-submit protection, and undo or confirmation when destructive.

## Navigation rules

- Every visible navigation item resolves to a working destination.
- Back, cancel, close, deep links, refresh, and browser/device history preserve understandable state.
- Selected tabs and filters match the displayed content and survive navigation when users expect them to.
- Authentication returns users to the intended task after sign-in.
- Role and permission differences are enforced in both UI and backend.

## Data integrity

- Forms validate at the field and submission boundaries without deleting user input.
- Optimistic updates reconcile with server truth and roll back visibly on failure.
- Empty and seeded data represent the actual product domain; do not ship placeholder cards or dead actions.
- Realtime and cached views define ordering, conflict, reconnect, and stale-data behavior.

## Verification

Walk every primary journey from a clean start. Test the smallest and largest supported viewport, keyboard-only use, slow/failing requests, refresh in the middle of a flow, and destructive recovery. Report concrete routes and states verified.
