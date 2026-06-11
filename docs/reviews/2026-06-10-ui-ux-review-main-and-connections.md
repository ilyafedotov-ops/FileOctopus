# UI/UX Review — Main Interface & Connection Wizard

**Date:** 2026-06-10
**Scope:** Main commander workspace, first-run (welcome) wizard, Connections dialog (`ConnectServerDialog`)
**Method:** Live review in browser preview mode (Vite + preview transport, 1440×900) plus source audit of `packages/frontend/src/components/{WizardShell,FirstRunOverlay,DialogShell}.tsx`, `components/dialogs/ConnectServerDialog.tsx`, `pane/OperationToolbar.tsx`, `commands/toolbarConfig.ts`, `styles/regions/dialogs.css`.
**Relationship to other docs:** Complements `docs/ui-premium-polish-improvement-plan.md` (UPP). Items here are post-UPP regressions or gaps the UPP passes did not cover.

---

## Overall impression

The shell reads as a credible commander-style file manager: dual panes, F-key bar, activity rail, and a coherent dark token system. The biggest opportunities are in the dialogs — validation feedback in the Connections dialog is effectively invisible (the error class has no CSS at all), the wizard step chips truncate their labels at the default width, and the auth-method selector is both mis-placed and styled like a text input.

## Findings

### A. Connections dialog (`ConnectServerDialog`)

| #   | Finding                                                                                                                                                                                                                                                                                                                               | Severity    | Status                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `.fo-dialog-error` is referenced by `WizardShell`, `ConnectServerDialog`, and `NetworkLocationsDialog` but **no CSS rule exists anywhere** — validation errors render as bare unstyled text that blends into the form ("Password is required for a new connection." appears as a plain line above the Profile name label).            | 🔴 Critical | Fixed                                                                                                                                                                           |
| A2  | "WebDAV provider is not registered yet." warning banner is **always shown** on the General tab (the `unavailableProviders` block renders unconditionally), even when the user selected SFTP. Irrelevant noise on every new connection. The disabled `WebDAV — unavailable` option in the Protocol dropdown already communicates this. | 🔴 Critical | Fixed                                                                                                                                                                           |
| A3  | The authentication-method choice (Password / Private key) lives on the **SSH tab** while the Password field sits on **General**. A user creating a key-based SFTP profile must discover the SSH tab to switch auth — nothing on General hints that's possible.                                                                        | 🔴 Critical | Fixed — auth selector, detected keys, key path, and passphrase moved to General; SSH tab keeps transport options                                                                |
| A4  | The auth options are styled identically to text inputs (`fo-connect-auth-option` shares the field background + border); the active state is only a 3 px inset bar. They read as disabled inputs, not as a choice.                                                                                                                     | 🟡 Moderate | Fixed — restyled as a real segmented control with filled active state                                                                                                           |
| A5  | Validation reports a single field ("Password is required…") even when profile name, host, and username are also empty; the generic message also omits which fields failed.                                                                                                                                                            | 🟡 Moderate | Fixed — message now enumerates the missing fields                                                                                                                               |
| A6  | Stale validation errors persist while switching tabs and after fixing fields, until the next Save/Test click.                                                                                                                                                                                                                         | 🟡 Moderate | Fixed — editing a flagged field clears its flag and updates the banner live; switching auth kind clears password/key flags                                                      |
| A7  | Test & Trust summary renders `-:22` for an empty host.                                                                                                                                                                                                                                                                                | 🟢 Minor    | Fixed — shows `—` until a host is set                                                                                                                                           |
| A8  | The disabled **Connect** button gives no reason; it requires a saved profile but nothing says so.                                                                                                                                                                                                                                     | 🟢 Minor    | Fixed — tooltip "Save the connection profile first"                                                                                                                             |
| A9  | Terminology drift: sidebar says "Add server…", section header "Network", dialog title "Connections", row "New Connection".                                                                                                                                                                                                            | 🟢 Minor    | Fixed — standardized on "connection": sidebar row/icon, Go menu, command palette ("Add Connection…", "Edit Connection…"), drive targets, Network Locations dialog, help content |

### B. First-run (welcome) wizard (`FirstRunOverlay` + `WizardShell`)

| #   | Finding                                                                                                                                                                                                                                         | Severity    | Status                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------ |
| B1  | Step labels truncate at the default dialog width ("Wor…", "App…", "Loc…", "Net…", "Ter…") — `.fo-first-run-dialog` is 34 rem wide while six labeled chips need ~42 rem. The progress indicator is unreadable on first contact with the product. | 🔴 Critical | Fixed — dialog widened, chip padding tightened, full label exposed via `title` |
| B2  | "Dual pane" and "Activity rail" cards are focusable `<button>`s with **no click handler** — keyboard users tab onto dead controls; the actionable "Start" card is visually identical to the inert ones.                                         | 🟡 Moderate | Fixed — inert cards are now non-interactive `<div>`s                           |
| B3  | Heading/paragraph rhythm is broken: UA margins on `h3`/`p` stack with the grid gap, producing uneven, oversized gaps between the step title and its description.                                                                                | 🟡 Moderate | Fixed — margins reset inside `.fo-first-run-body`                              |
| B4  | The Finish step still shows **Skip** next to **Start**, two buttons that do the same thing.                                                                                                                                                     | 🟢 Minor    | Fixed — cancel hidden on the final step (`showCancel` prop)                    |
| B5  | Steps 2–5 are signpost pages (one sentence + a button that closes the wizard). Six steps is a lot of clicking for the content delivered; consider collapsing Appearance/Locations/Terminal into one "Customize" step.                           | 🟡 Moderate | Noted — content restructuring deferred (scope)                                 |

### C. Main interface

| #   | Finding                                                                                                                                                                            | Severity    | Status                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| C1  | The Root navigation button shows a hardcoded `\` (backslash) glyph — a Windows path separator — on macOS/Linux.                                                                    | 🟡 Moderate | Fixed — platform-aware separator glyph                                   |
| C2  | Toolbar label "Open with default" truncates to "Open with def…" at 1440 px.                                                                                                        | 🟡 Moderate | Fixed — label shortened to "Open"; full description stays in the tooltip |
| C3  | "Folder+" toolbar label is inconsistent with the F7 bar ("New Folder") and the command palette.                                                                                    | 🟢 Minor    | Fixed — renamed to "New Folder"                                          |
| C4  | Sidebar Network section has two stacked "Add server" affordances (header icon button + "Add server…" row).                                                                         | 🟢 Minor    | Noted — common pattern, low priority                                     |
| C5  | The active path is displayed in four places at once (title bar, breadcrumb, command-line strip, status bar). Redundant but consistent with the commander idiom.                    | 🟢 Minor    | Noted                                                                    |
| C6  | Row selection highlight is painted per-cell, leaving unhighlighted gutters between columns. Classic-commander styling; flagging for a deliberate decision rather than as a defect. | 🟢 Minor    | Noted                                                                    |

## What works well

- Consistent token-driven theming (`--fo-*`), focus rings, and density scaling across the shell; the UPP passes clearly paid off in the chrome.
- `DialogShell`/`WizardShell` give every dialog the same frame, focus trap, and Escape behavior.
- The Connections dialog's two-pane manager (profile list + editor) is a solid model, and keychain messaging ("Credentials stay in the OS keychain") is good trust-building copy.
- Strong accessibility skeleton: roles on tabs/toolbars/dialogs, aria-labels on icon buttons, `aria-invalid` on failed fields.

## Priority recommendations (implemented in this pass)

1. **Make validation visible** — style `.fo-dialog-error` as a danger banner (A1) and enumerate missing fields (A5).
2. **Cut the noise in the connection form** — drop the unconditional WebDAV warning (A2) and put the auth-method choice where users look for it, on General (A3, A4).
3. **Make the wizard read at first glance** — widen the first-run dialog so step labels fit (B1), kill dead buttons (B2), fix text rhythm (B3).
4. **Platform polish** — correct the root glyph (C1) and the truncating/inconsistent toolbar labels (C2, C3).

## Deferred / follow-up

- B5: restructure first-run content (fewer, richer steps).
- C6: decide whether row selection should span the full row width.
- Contrast audit across the three themes (UPP-I2 remainder) still pending.

## Follow-up pass (2026-06-11)

- A6 completed: `clearInvalidField` removes a field's invalid flag on edit and recomputes the banner message; the banner disappears once the last flagged field is fixed. Covered by a new test ("clears field errors as the user fixes them").
- A9 completed: "server" → "connection" across `Sidebar`, `goMenu`, `registryData` (`nav.addServer` → "Add Connection…", `nav.connectServer` → "Edit Connection…" since it opens the editor for an existing profile), `driveTargets`, `NetworkLocationsDialog` (also gained `role="alert"` on its error line), and help content.
