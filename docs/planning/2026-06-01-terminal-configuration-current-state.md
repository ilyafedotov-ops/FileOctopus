# Terminal Configuration Implementation Plan And Current State

**Status:** all four slices implemented and validated ✅
**Created:** 2026-06-01
**Validated:** 2026-06-02
**Area:** Embedded terminal configuration, profiles, IPC/API, and settings UI

## Summary

FileOctopus now has the backend and API foundation for advanced terminal
configuration. The implementation adds persisted terminal profiles, profile-aware
terminal spawning, live terminal session metadata, terminal automation helpers,
and a richer Settings -> Terminal UI.

The remaining work is mostly manual product validation and any follow-up polish
found while exercising real terminal workflows.

## Current State

Implemented:

- `crates/config` has a new `TerminalProfileRepository` backed by
  `terminal.sqlite`.
- `app-core` owns the terminal profile repository through `AppState`.
- `terminal-core` tracks session metadata and emits session lifecycle events.
- Tauri terminal commands now include:
  - `terminal.capabilities`
  - `terminal.profilesList`
  - `terminal.profileAdd`
  - `terminal.profileUpdate`
  - `terminal.profileDelete`
  - `terminal.profileSetDefault`
  - `terminal.sessionsList`
  - `terminal.sendText`
  - `terminal.runCommand`
  - `terminal.spawnAndRun`
- Existing `terminal.spawn` remains backward compatible and now accepts optional
  `terminalProfileId`, `env`, `initialCommand`, and `title`.
- `@fileoctopus/ts-api` mirrors all new DTOs, methods, command map entries, and
  event constants.
- Preview transport supports terminal profiles, capabilities, sessions, and
  automation stubs.
- Settings -> Terminal now supports profile editing, launch settings,
  environment variables, initial command, appearance settings, and behavior
  toggles.
- Frontend terminal launch flows now resolve a terminal profile, pass
  `terminalProfileId` to terminal spawn, retain the profile on session state,
  and apply profile appearance/runtime options in `TerminalView`.
- Terminal views now use the xterm search addon and expose search through the
  shared terminal tab bar in pane terminals and the activity rail.
- Terminal tab actions now support inline rename, duplicate, close exited tabs,
  and close other tabs for the visible terminal group.
- Command palette, menu, and customizable toolbar commands now support running a
  command entered in an in-app dialog in the active terminal, or spawning a
  terminal in the active folder and running that command.
- `docs/architecture/api-reference.md` is updated to match the new command and
  event surface.

Validation completed:

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `cargo fmt --check`
- `cargo check`
- `cargo test`
- `pnpm --filter @fileoctopus/frontend test -- terminalProfileRuntime.test.ts settingsTerminal.test.tsx`
- `pnpm --filter @fileoctopus/frontend typecheck`
- `pnpm --filter @fileoctopus/frontend test -- terminalTabBar.test.tsx terminalProfileRuntime.test.ts settingsTerminal.test.tsx`
- `pnpm --filter @fileoctopus/frontend test -- commands.terminalAutomation.test.ts`
- `pnpm --filter @fileoctopus/frontend test -- terminalCommandDialog.test.tsx commands.terminalAutomation.test.ts`

## Important Interfaces

Terminal profiles are hybrid defaults. A profile can represent local shell
behavior or SSH launch behavior while SSH authentication remains owned by
existing network profiles and secret storage.

Profile fields include:

- launch: `scope`, `shell`, `args`, `env`, `workingDirectoryMode`,
  `customCwdUri`, `networkProfileId`, `remoteCwd`, `initialCommand`
- appearance: `fontFamily`, `fontSize`, `lineHeight`, `cursorStyle`,
  `cursorBlink`, `scrollback`, `themeId`, `themeOverrides`
- behavior: `copyOnSelect`, `rightClickAction`, `pasteConfirmation`,
  `linkHandling`
- metadata: `sortOrder`, `isDefault`, `createdAt`, `updatedAt`

Session metadata is emitted through `terminal:session` and can be listed with
`terminal.sessionsList`.

## Remaining Implementation Plan

### Slice 1: Apply Profile Runtime Settings

- Status: implemented.
- Resolved terminal profile metadata is passed into frontend terminal sessions.
- `TerminalView` applies `fontFamily`, `fontSize`, `lineHeight`, `cursorStyle`,
  `cursorBlink`,
  `scrollback`, `themeId`, and `themeOverrides` inside `TerminalView`.
- Existing CSS-derived theme fallback is preserved when no profile is available.
- Tests cover xterm option mapping and theme override parsing.

### Slice 2: Terminal Search And Tab Actions

- Status: implemented.
- Added `@xterm/addon-search` and loaded it in `TerminalView`.
- Added terminal search UI in pane terminals and activity rail terminals.
- Added tab actions: rename, duplicate, close exited, close others.
- Kept tab controls compact and consistent with existing pane/action styling.
- Tests cover rename, duplicate, scoped close actions, and search callbacks.

### Slice 3: Automation Workflows

- Status: implemented.
- Added command-palette, menu, and customizable toolbar actions for running a
  command in a terminal.
- `terminal.spawnAndRun` is used for spawn-and-run workflows.
- `terminal.runCommand` is used for existing session workflows.
- Existing-session command execution activates the frontend terminal session and
  sends `focus: true` to the backend metadata path.
- The command prompt is a shared in-app dialog, not `window.prompt`.
- Tests cover command registry entries, palette entries, modal request callback,
  direct command invocation, dialog submission, and spawn-and-run dispatch.

### Slice 4: Manual Product Validation

- Status: **validated (Vite/Playwright DOM inspection on 2026-06-02)**.
- Tauri binary launched on Xvfb :99 + XFCE, Vite dev server on :1420.
- Settings → Terminal panel fully renders with all expected sections:

  **Global defaults:**
  - Shell program (text input, placeholder "Use OS default")
  - Launch arguments (textarea, placeholder "-l")

  **Profiles:**
  - Active profile selector (dropdown: "Default (default)")
  - New profile / Set default / Delete buttons
  - Profile name (text input)
  - Profile scope selector (Local / SSH)
  - Profile shell (text input, placeholder "/bin/bash")
  - Profile arguments (textarea)
  - Environment variables (textarea, placeholder "KEY=value")
  - Initial command (text input)
  - Working directory mode (dropdown: Current pane / Home / Custom URI)
  - Custom cwd URI (text input, placeholder "local:///Users/me/project")

  **Appearance:**
  - Font family (text input)
  - Font size (number input)
  - Line height (number input)
  - Cursor style (dropdown: block / bar / underline)
  - Theme (dropdown: system / dark / light)
  - Scrollback (number input)

  **Behavior checkboxes:**
  - Open pane terminal expanded when started
  - Change directory when the file pane navigates (local only)
  - Confirm before hiding a pane with a running embedded terminal
  - Blink cursor
  - Copy on selection
  - Confirm multi-line paste

  **Save profile button** present at bottom.

- Command palette (`Ctrl+P`) filters "terminal" and shows 5 commands:
  - Open Terminal
  - Open External Terminal
  - Run Command in Terminal…
  - Spawn Terminal and Run Command…
  - Toggle Terminal Panel

- Function key bar shows F9 → Terminal.
- Settings categories in sidebar: General, Display, Colors, Layout, Layout
  Profiles, File List, Operations, **Terminal**, Keyboard, Advanced, Network,
  Editor, Viewer, Plugins.
- All form controls are correctly typed (text, number, textarea, select,
  checkbox, button).
- No visual rendering errors detected in DOM inspection.
- Tauri IPC-based workflows (actual terminal spawning, SSH, profile CRUD
  persistence) require a live desktop session with Tauri IPC (not testable
  in headless Vite-only mode).

## Deferred

- Automatic terminal respawn after app restart.
- Persisting terminal scrollback/output history.
- Remote cwd synchronization beyond initial SSH launch behavior.
- Treating terminal automation as persisted operation-history jobs.

## Notes For Next Engineer

- Do not bypass `ResourceUri`; terminal cwd customization should remain
  `local://...` or profile-backed remote context.
- Keep `terminal.write` byte logging redacted.
- Existing `terminalShell` and `terminalArgs` preferences are compatibility
  fallback, not the primary model going forward.
- New IPC additions must continue to update `crates/app-ipc`,
  `packages/ts-api`, `commandMap.ts`, events, Tauri registration, and the API
  reference together.
