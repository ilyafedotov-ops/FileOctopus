# FileOctopus UI Improvements Implementation Plan

**Date:** 2026-06-01
**Status:** Proposed
**Goal:** Convert the next set of visible FileOctopus UI improvements into a scoped implementation backlog that fits the existing React/Tauri architecture, preserves commander-style density, and avoids IPC changes unless explicitly called out.

## Scope

This plan focuses on frontend polish and workflow clarity in the existing shell, pane, sidebar, preview, command, and settings surfaces.

Primary frontend areas:

- `packages/frontend/src/pane/`
- `packages/frontend/src/shell/`
- `packages/frontend/src/sidebar/`
- `packages/frontend/src/components/`
- `packages/frontend/src/styles/regions/`
- `packages/frontend/tests/`

Out of scope unless a task explicitly requires it:

- New Rust filesystem commands
- Changes to `ResourceUri` or IPC DTOs
- New long-form documentation
- Major redesign away from the dual-pane commander model

## Implementation Principles

- Keep the dual-pane file manager dense, keyboard-first, and operational.
- Prefer existing UI primitives from `@fileoctopus/ui` and existing FileOctopus components.
- Use theme, density, radius, focus, and spacing tokens instead of hard-coded values.
- Keep interactions available by keyboard and visible through focus states.
- Add focused tests for behavior and state changes; use visual regression snapshots where the change is mainly presentational.

## Phase 1: File Table Visual Hierarchy

**Priority:** High

Improve the file table so it reads as a polished primary work surface while preserving density.

Implementation notes:

- Refine row hover, selected, focused, and active/inactive-pane states in `styles/regions/pane.css`.
- Improve column header contrast, sort affordance, and resize handle visibility.
- Align metadata columns consistently in details mode.
- Keep row height driven by density tokens.
- Verify `details`, `list`, `icons`, and `columns` modes still behave consistently.

Acceptance criteria:

- Active-pane selection is visually distinct from inactive-pane selection in light, dark, and commander-blue themes.
- Hover, focus, selected, and dragged states do not overlap incoherently.
- Column headers remain readable in compact density.
- Existing file-row accessibility and column tests pass.

Suggested tests:

- `packages/frontend/tests/fileRow.test.tsx`
- `packages/frontend/tests/fileRowAccessible.test.tsx`
- `packages/frontend/tests/columnWidths.test.ts`
- `packages/frontend/tests/visualSnapshots.test.tsx`
- focused Playwright visual checks for table states

## Phase 2: Empty, Loading, Error, And Permission States

**Priority:** High

Make pane state screens more actionable when a directory is empty, loading, unavailable, permission-blocked, or offline.

Implementation notes:

- Extend `PaneStateView` styling and copy for common states.
- Add contextual actions where already supported by props, such as retry, refresh, paste, create folder, and open parent.
- Make remote/offline states visually distinct without adding new backend contracts.
- Ensure state content is compact enough to fit inside one pane.

Acceptance criteria:

- Empty folders expose the most useful available action.
- Error and permission states show a clear cause and recovery path.
- Loading state is centered and calm, with reduced-motion support.
- No pane state introduces layout shift in split-pane mode.

Suggested tests:

- `packages/frontend/tests/paneOfflineState.test.tsx`
- `packages/frontend/tests/paneNetworkState.test.tsx`
- `packages/frontend/tests/appShell.test.tsx`
- add focused `PaneStateView` tests if coverage is missing

## Phase 3: Preview Panel Controls

**Priority:** High

Upgrade the preview panel from a passive viewer into a small, useful inspection surface.

Implementation notes:

- Add a compact toolbar to `PreviewPanel`.
- Add image fit, actual-size, and zoom controls.
- Add text preview line numbers and copy actions where practical.
- Add open externally and copy path actions using existing command/client paths where available.
- Keep media playback controls native.
- Avoid loading files larger than existing preview byte limits unless a backend change is planned separately.

Acceptance criteria:

- Text, image, PDF, audio, and video preview modes still load correctly.
- Image zoom and fit controls do not cause overflow outside the preview panel.
- Text previews retain truncation messaging.
- Preview close behavior and Escape handling remain intact.

Suggested tests:

- `packages/frontend/tests/previewPanel.test.tsx`
- `packages/frontend/tests/viewerDialog.test.tsx`
- `packages/frontend/tests/viewerGallery.test.tsx`
- focused visual check for image and text preview

## Phase 4: Drag-And-Drop Feedback

**Priority:** High

Make drag-and-drop operations easier to understand before the user drops files.

Implementation notes:

- Improve the drop overlay in `FilePanel`.
- Distinguish copy and move intent based on the existing drop effect.
- Show the destination path more clearly.
- Add invalid-drop feedback when the dragged data is unsupported.
- Keep operation execution routed through the existing file-operation flow.

Acceptance criteria:

- Drop overlay identifies destination and operation kind.
- Cross-pane drag state remains clear in both panes.
- Unsupported drops do not imply a valid operation.
- Existing drag/drop tests pass.

Suggested tests:

- `packages/frontend/tests/dragDrop.test.tsx`
- focused Playwright drag/drop check if practical

## Phase 5: Settings Dialog Cleanup

**Priority:** Medium-High

Make settings easier to scan and less visually raw while keeping the existing panel structure.

Implementation notes:

- Refine `SettingsDialog` and settings section primitives.
- Keep the left navigation sticky and readable.
- Group related controls with clearer section boundaries.
- Add visible reset/unsaved-state affordances only if the current preference flow supports them.
- Ensure text and controls fit in compact windows.

Acceptance criteria:

- Settings panels have consistent spacing, labels, descriptions, and control alignment.
- Left navigation remains usable with all existing settings categories.
- Dialog layout works at the current tested viewport sizes.
- No settings persistence behavior changes accidentally.

Suggested tests:

- `packages/frontend/tests/settingsDialog.test.tsx`
- `packages/frontend/tests/settingsPolish.test.tsx`
- `packages/frontend/tests/settingsAdvanced.test.tsx`
- `packages/frontend/tests/settingsNetwork.test.tsx`
- `packages/frontend/tests/settingsEditor.test.tsx`

## Phase 6: Command Palette Upgrade

**Priority:** Medium

Make the command palette better for keyboard-first users.

Implementation notes:

- Group results by command surface or category.
- Show shortcut hints from the command registry.
- Highlight matched query text in labels.
- Preserve existing command dispatch and close behavior.
- Consider recent commands only if there is already a lightweight storage pattern to reuse.

Acceptance criteria:

- Palette search remains fast and keyboard-navigable.
- Shortcut hints match the registered bindings.
- Highlighting does not break screen-reader labels.
- Existing command palette tests pass.

Suggested tests:

- `packages/frontend/tests/commandPalette.test.tsx`
- `packages/frontend/tests/commands.registry.test.ts`
- `packages/frontend/tests/defaultBindings.test.ts`

## Phase 7: Sidebar Status And Density Improvements

**Priority:** Medium

Improve sidebar scanning for locations, recent folders, smart folders, volumes, and network entries.

Implementation notes:

- Add compact status badges for remotes, volumes, and stale or unavailable locations where state already exists.
- Refine section spacing and item hover/focus states.
- Preserve current context menus and rename behavior.
- Avoid adding backend polling.

Acceptance criteria:

- Network and volume states are distinguishable without reading long descriptions.
- Sidebar remains compact in narrow layouts.
- Context menus still target the correct item.
- Existing sidebar tests pass.

Suggested tests:

- `packages/frontend/tests/sidebar.test.tsx`
- `packages/frontend/tests/sidebarNetworkStatus.test.tsx`
- `packages/frontend/tests/sidebarRecentGroups.test.tsx`
- `packages/frontend/tests/sidebarSmartFolders.test.tsx`
- `packages/frontend/tests/ejectVolume.test.tsx`

## Phase 8: Tab Bar Affordances

**Priority:** Medium

Make pane tabs easier to read and manage.

Implementation notes:

- Improve active/inactive tab contrast.
- Make close affordances visible without becoming noisy.
- Add overflow affordance if current horizontal scroll is not discoverable.
- Keep the tab bar compact and consistent across panes.

Acceptance criteria:

- Active tab is obvious in every theme.
- Close buttons remain keyboard and pointer accessible.
- Long tab names truncate cleanly.
- Existing tab-session tests pass.

Suggested tests:

- `packages/frontend/tests/tabBar.test.tsx`
- `packages/frontend/tests/tabSessions.test.ts`
- visual snapshot coverage for tab states

## Phase 9: Operation And Job Visibility

**Priority:** Medium

Make long-running work visible without stealing focus from file operations.

Implementation notes:

- Add compact progress/status chips where the toolbar or activity rail already exposes job state.
- Improve pause, resume, cancel, and failed-job affordances.
- Add live-region announcements for important job state changes if not already covered.
- Preserve persisted operation history behavior.

Acceptance criteria:

- Active jobs can be understood from the main shell without opening a full dialog.
- Failed and paused states are visually distinct.
- Job controls remain accessible by keyboard.
- Existing job and operation tests pass.

Suggested tests:

- `packages/frontend/tests/jobPauseResume.test.ts`
- `packages/frontend/tests/jobCardUtils.test.ts`
- `packages/frontend/tests/jobsBeforeUnload.test.tsx`
- `packages/frontend/tests/operationToolbar.test.tsx`
- `packages/frontend/tests/toolbarJobsLabel.test.ts`

## Phase 10: Theme Refinement

**Priority:** Medium

Add or refine a modern neutral theme while preserving the existing commander-blue identity.

Implementation notes:

- Keep theme definitions centralized in `styles/themes.css` and token files.
- Reduce over-saturated selection and chrome colors in the neutral theme.
- Audit contrast for text, focus rings, selection, and disabled states.
- Avoid one-off color overrides in regional CSS.

Acceptance criteria:

- Light, dark, commander-blue, and the neutral theme render all major surfaces correctly.
- Theme tokens pass existing token tests.
- No new hard-coded regional CSS colors are introduced.

Suggested tests:

- `packages/frontend/tests/themeTokens.test.ts`
- `packages/frontend/tests/themeRegistry.test.ts`
- `packages/frontend/tests/visualSnapshots.test.tsx`

## Recommended Sprint Order

1. Phase 1: File Table Visual Hierarchy
2. Phase 2: Empty, Loading, Error, And Permission States
3. Phase 3: Preview Panel Controls
4. Phase 4: Drag-And-Drop Feedback
5. Phase 5: Settings Dialog Cleanup

These five phases are the best first sprint because they are highly visible, mostly frontend-contained, and fit the existing component boundaries.

## Verification Checklist

Run the focused tests for the touched area, then run:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

For broad visual changes, also run:

```sh
pnpm test:e2e
```

Use targeted Playwright screenshots for:

- file table in light, dark, and commander-blue
- preview panel text and image modes
- settings dialog
- drag/drop overlay
- sidebar narrow layout

## Risk Notes

- Visual changes can break existing visual snapshots; update snapshots only after manual review.
- Settings polish must not change persistence semantics.
- Preview controls should respect existing file-size limits.
- Drag/drop polish must not bypass the planned file-operation pipeline.
- Any IPC change must update Rust DTOs, TypeScript DTOs, command maps, handlers, and API documentation together.
