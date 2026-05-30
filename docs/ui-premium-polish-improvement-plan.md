# FileOctopus — Premium UI Polish & Improvement Plan

**Document status:** Source of truth for premium UI polish (Draft for implementation)
**As of:** 2026-05-30
**Owners:** Frontend + Design (review routes to `@ilyafedotov`)
**Relationship to other docs:** This plan is the **single source of truth for premium UI polish, visual consistency, and commander-style refinement.** It does not replace the [UI Design & Layout Specification](./FileOctopus_UI_Design_and_Layout_Specification-1.md) (structure/behavior), the [Menu & Modal Specification](./plans/FileOctopus_Menu_and_Modal_Specification.md) (menu/modal contract), or the [API reference](./architecture/api-reference.md) (IPC). It layers a _premium-finish_ discipline on top of them. Where a visual or interaction rule here conflicts with an older visual note in those docs, **this document wins**; where behavior/IPC is concerned, those docs win.

---

## 0. Implementation status

**Last updated:** 2026-05-30 · **Verification at last update:** `pnpm typecheck`, `pnpm lint`, `pnpm format:check` clean; frontend **1039 tests** + UI **21 tests** pass (0 failures).

### Progress by backlog item

| Item                                      | Status                 | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UPP-H1 — typography/spacing/status tokens | ✅ Done (tokens)       | `--fo-font-size-*`, `--fo-line-*`, `--fo-success/-warning-bg/-border` (theme-derived via `color-mix`) added + consumed; font-size literals in `shell/components/jobs/sidebar/shared/dialogs` swept to scale.                                                                                                                                                                                                                                |
| UPP-H2 — radius scale                     | ✅ Done                | `--fo-radius-xs: 2px` added; commander content radii tokenized.                                                                                                                                                                                                                                                                                                                                                                             |
| UPP-A1 — chrome tokenization              | ✅ Done                | Light-theme dark-titlebar bug fixed; topbar/menubar/toolbar/status-fg tokenized; `--fo-chrome-hover-bg/-text` per theme.                                                                                                                                                                                                                                                                                                                    |
| UPP-A2 — standard focus ring              | ✅ Done                | `--fo-focus-ring*` tokens; button/input/segmented/menubar focus converged.                                                                                                                                                                                                                                                                                                                                                                  |
| UPP-C1 — unmistakable active pane         | ✅ Done                | Accent frame + 2px top strip + header underline + accent pane-label; was previously framed in near-invisible `--fo-tab-bg`.                                                                                                                                                                                                                                                                                                                 |
| UPP-D1 — shared menu/popover frame        | 🟡 Partial             | Elevation tokens made theme-aware; inline popover shadows consolidated onto `--fo-elevation-popover`; undefined submenu shadow fixed. Shared `MenuSurface` component not yet extracted.                                                                                                                                                                                                                                                     |
| UPP-D2 — keyboard-navigable menus         | ✅ Done (DropdownMenu) | Arrow/Home/End/type-ahead/Esc/Tab + focus-on-open + disabled-skip + visible focus on `DropdownMenu`; `ContextMenu` already had arrow nav.                                                                                                                                                                                                                                                                                                   |
| UPP-E1 — shared dialog frame              | ✅ Done (1 exception)  | `DialogShell` primitive built (backdrop, `<dialog>`, focus-trap+restore, Escape, `aria-modal`, header/subtitle/close, footer slot) + 5 tests. **All 15 straightforward dialogs migrated**; `ConnectServerDialog` now uses `WizardShell` (UPP-F3). Only `OperationDialogView` (structurally distinct conflict/operation dialog) remains on the raw pattern, slated for UPP-E2. Destructive-button-not-default rule applied during migration. |
| UPP-F1 — `WizardShell` stepped frame      | ✅ Done                | Reusable `WizardShell` (composes `DialogShell`) with a numbered token-driven step indicator (todo/active/done), reached-step jumping, and a Back/Cancel/primary footer; per-step validation gating driven by the caller. 5 unit tests.                                                                                                                                                                                                      |
| UPP-F3 — connection setup wizard          | ✅ Done                | `ConnectServerDialog` rewritten as a real stepped wizard on `WizardShell` (Target → Credentials → Test → Save) with fields gated per step and per-step validation; previously a cosmetic stepper that showed all fields at once. No backend/IPC change (same `onSave` contract).                                                                                                                                                            |
| UPP-J1 — motion tokens + reduced motion   | ✅ Done                | `--fo-motion-fast/-med/-ease` added + used in chrome/control transitions; global `@media (prefers-reduced-motion: reduce)` guard collapses all animations/transitions (also satisfies the reduced-motion half of UPP-I2).                                                                                                                                                                                                                   |
| UPP-K2 — token-lint guards                | ✅ Done                | `themeTokens.test.ts` grown to ~39 assertions; `pane/jobs/sidebar` guarded hex-free, `dialogs` guarded to classic-palette only.                                                                                                                                                                                                                                                                                                             |

Partial: **UPP-I1** — `DialogShell` adds `aria-modal` + focus trap/restore; `DropdownMenu`/`ContextMenu` expose `role="menu"`/`menuitem` with keyboard nav; toasts now use a persistent `aria-live` region with assertive `role="alert"` for errors / polite `role="status"` for success/info. Remaining: job-progress live-region announcements. **UPP-I2** — reduced motion done; contrast audit across the 3 themes pending.

Other epics (UPP-B\*, UPP-C3/C4, UPP-E2/E3, UPP-F2 archive wizard, UPP-G\*, UPP-K1) **not yet started.**

### Bugs fixed in passing

- `useToolbarOverflowTier` skipped its initial width measurement without `ResizeObserver` (jsdom) → tier stuck at `full`.
- Primary-button hover hard-coded `#006bb3` (only correct for the default-blue accent) → derived from active accent via `color-mix`.
- Submenu referenced undefined `--fo-shadow-popover` (no shadow) → `--fo-elevation-popover`.
- `dialogs.css` referenced undefined `--fo-surface-alt` (Catppuccin leftover) → `--fo-surface-elevated`.
- success/warning badges hard-coded light colors (broken in dark) → theme-derived status tokens.
- Destructive dialog buttons used `variant="primary"` and could be default-focused → `danger` + Cancel-first.

### Metrics movement

- Regional-CSS hardcoded hex: **164 → 92** (remainder is intentional: theme-palette token defs, window-dot colors, accent-picker swatches).
- Regional-CSS `font-size` literals: **192 → 47** (remainder are off-scale 14/16/9/48px).
- Files now guarded hex-free: `pane.css`, `jobs.css`, `sidebar.css`; `dialogs.css` guarded to classic-palette defs only.
- Tests: **1060 total** (1039 frontend + 21 UI), all green.

### UPP-E1 dialog migration — complete (with 2 intentional exceptions)

**Migrated (15):** GoToLocation, ClearRecentLocations, About, ClosePaneTerminal, ErrorDetails, RemoveServer, OperationHistory, RecentLocations, ManageFavorites, VolumePicker, PluginManager, SyncDirectories, NetworkLocations, HotlistDialog, ManageHotlistDialog. Several previously used non-standard `<div role="dialog">` markup with no focus-trap and now gain focus-trap + restore, Escape, and `aria-modal` for free.

**Now on `WizardShell` (UPP-F3):**

- `ConnectServerDialog` — rebuilt as a stepped wizard rather than a flat `DialogShell` migration.

**Intentionally not migrated (1):**

- `OperationDialogView` — the conflict/operation dialog; structurally distinct, slated for the UPP-E2 conflict-dialog pass.

---

## 1. Executive summary

### 1.1 Current UI maturity assessment

FileOctopus is **far past prototype**. The shell already ships the hard parts of a commander-style file manager:

- A real dual-pane workspace (`styles/regions/shell.css` `.fo-dual-pane`) with horizontal/vertical split, resizers, sidebar, and a job/activity rail.
- A **commander function-key bar** (`.fo-commander-bar`, 10-column F1–F10 strip) and a path rail + status bar stack (`ShellStatusBar.tsx`, `StatusBar.tsx`).
- A working **design-token layer**: spacing (`--fo-spacing-*`), radius (`--fo-radius-*`), elevation (`--fo-elevation-*`), component heights (`--fo-toolbar-height`, `--fo-row-height`, …), and three density modes (`compact`/`comfortable`/`spacious`) in `packages/ui/src/tokens.css`.
- **Three themes** — default dark, explicit `light`, and a retro `commander-blue` skin — plus seven accent swatches and font/icon scale switches.
- A deep component inventory: 18 dialog components (`components/dialogs/*`) plus shell-level dialogs, 15 settings panels (`components/settings/*`), shared UI primitives (`packages/ui/src/*`: `Button`, `IconButton`, `ToolbarButton`, `DropdownMenu`, `SegmentedControl`, `BreadcrumbPath`, …), context-menu builders, command palette, toasts, viewer/editor.
- Strong test signal: 877 frontend tests, 479 Rust tests.

The product is **functionally complete but visually uneven.** It looks like a capable app assembled feature-by-feature rather than a single, coherently finished premium tool.

### 1.2 Main problems

1. **Tokens exist but are not consumed.** There are **164 hard-coded hex colors across the regional CSS** (93 in `shell.css` alone, 39 in `dialogs.css`), plus ~190 literal `font-size: NNpx` and ~54 literal `border-radius` declarations. The topbar, menubar, and parts of chrome are pinned to dark values (`background: #3c3c3c`, hover `#505050`) instead of tokens — so the **light theme renders a dark titlebar/menubar**, and `commander-blue` only works because `shell.css` re-declares everything a second time. This is the single biggest premium-feel and consistency defect.
2. **No typography scale.** ~192 literal `font-size` declarations scattered ad-hoc (10/11/12/13/14/15/16/48px). There is no `--fo-font-size-*` ramp, so hierarchy is accidental, not designed.
3. **Inconsistent radii and elevation.** Radius literals range across 2/3/4/6/7/8/10/999px with no rule; `--fo-radius-*` (6/10/14) and `--fo-elevation-*` are barely used. Some surfaces use `box-shadow: 0 8px 20px var(--fo-menu-shadow)` inline rather than the elevation tokens. The result is mixed "sharp commander" (2px) and "soft SaaS" (8–10px) corners in the same screen.
4. **Focus & active-pane treatment is under-designed.** The active pane must be unmistakable (per UI spec §3.2); today the accent cues are thin and not consistently themed. Focus-visible rings are not standardized into one token-driven mixin.
5. **Dialog system is large but not uniform.** `dialogs.css` is 2,984 lines across 19 dialogs; headers, footers, button order, and spacing are reimplemented per dialog rather than enforced by a shared `DialogShell`/`DialogHeader`/`DialogFooter` contract.
6. **Command duplication risk.** Commands surface in the menu bar, pane toolbar + overflow, context menus, command palette, **and** the F-key bar. Without an explicit ownership matrix, the same action gains divergent labels/icons/enablement across surfaces.
7. **Light theme is a second-class citizen.** Because chrome is hard-coded dark, light mode is visibly broken in places — unacceptable for "production-ready."

### 1.3 Target design outcome

A **single, coherent, premium commander.** Dense and fast like Total Commander / FAR, but with the finish of a modern native desktop app (think the restraint of VS Code / Nova / Linear, not a web dashboard). Concretely:

- 100% of chrome/dialog/menu color comes from theme tokens; **all three themes (and light) render correctly with zero hard-coded hex in regional CSS.**
- A designed **typographic scale, spacing scale, radius scale, and elevation scale** — all token-driven and density-aware.
- An **unmistakable active pane**, standardized focus rings, and consistent selection states.
- One **shared dialog frame** and one **shared menu/popover frame** so every modal and menu is pixel-consistent.
- An explicit **command-surface ownership matrix** so toolbar/menu/F-bar/palette never drift or pointlessly duplicate.
- Commander identity preserved: dense rows, F-key bar, keyboard-first, dual-pane — refined, not flattened.

---

## 2. Design principles

### 2.1 Premium commander-style desktop principles

- **Commander first, web never.** Dual-pane, F-keys, keyboard targeting, dense rows are the identity. Never trade density for whitespace "breathing room." No hero sections, no card grids for file lists, no oversized rounded buttons.
- **Quiet chrome, loud content.** Chrome (titlebar, toolbar, status, F-bar) is low-contrast and recessive; file content and the active pane are where contrast and accent live.
- **Token-driven or it doesn't ship.** No hard-coded color, size, radius, or shadow in component CSS. Everything resolves to a token. This is what makes themes and density actually work.
- **One way to do a thing.** One dialog frame, one menu frame, one button system, one focus ring. Variations are props/variants, not new CSS.
- **Designed hierarchy.** Type, weight, and color come from a scale, not from whatever looked right that day.

### 2.2 Density rules

- Three density modes already exist (`data-density`). All new components **must** key row height, control height, and padding off the existing height tokens (`--fo-row-height`, `--fo-toolbar-height`, `--fo-statusbar-height`, …), never literals.
- `compact` is for power users on big trees; `comfortable` is default; `spacious` is for touch/accessibility. Components must remain legible and non-overlapping in all three.
- Vertical rhythm inside chrome uses the spacing scale (§8.1). Inside file rows, padding stays minimal (commander density) — never below 2px horizontal.

### 2.3 Visual hierarchy rules

- Exactly **three text weights** in use: 400 (body), 600 (labels/emphasis), 700/800 (keycaps, badges only).
- Color encodes role: `--fo-text` (primary), `--fo-secondary-text`, `--fo-muted-text`, `--fo-disabled-text`. Never use opacity to fake muted text on top of arbitrary backgrounds.
- Accent (`--fo-accent`) is reserved for: active pane cue, focus ring, primary button, selection, progress, and active nav. It is **not** a decoration color.

### 2.4 Keyboard-first interaction rules

- Everything reachable by mouse is reachable by keyboard. Every dialog traps focus, restores focus on close, and closes on `Esc`.
- Active pane owns all global/menu/toolbar/F-key commands (UI spec §3.2). `Tab`/`Shift+Tab` moves between regions predictably; arrow keys move within a pane and within open menus.
- Focus is **always visible** via the standard ring token, never removed without an equal replacement.

### 2.5 Consistency rules

- A component appears once as a shared primitive; surfaces compose it. No per-dialog re-styling of buttons, headers, inputs.
- A command has exactly one canonical label, icon, and enablement predicate, referenced by every surface (see §7 ownership matrix).
- Light, dark, and commander-blue are first-class; a change is "done" only when it is verified in all three plus all three densities.

---

## 3. Current-state findings

Format per area: **Exists / Missing / Inconsistent / Non-premium / Conflicts**.

### 3.1 Application shell & chrome (`shell/*`, `styles/regions/shell.css`)

- **Exists:** Topbar with brand + window dots + menubar + actions; grid shell frame (`grid-template-rows: auto auto 1fr auto`); workspace grid with sidebar/resizer/dual-pane/activity-rail; bottom stack of path rail + commander bar + status bar.
- **Missing:** Token-driven chrome colors; a real type scale; standardized focus ring; designed elevation between chrome layers.
- **Inconsistent:** Topbar/menubar colors are hard-coded (`#3c3c3c`, `#252526`, `#505050`, `#cccccc`) while the rest of the shell uses tokens; window dots are macOS-style traffic lights regardless of platform.
- **Non-premium:** In **light theme the titlebar/menubar stay dark** because of the hard-coded values; hover states are flat fills with no transition.
- **Conflicts:** UI spec §3.2 ("active pane obvious at all times") and §2.6 ("apply theme consistently across every UI surface") — currently violated by hard-coded chrome.

### 3.2 Toolbar / command strip (`pane/OperationToolbar.tsx`, `CommanderToolbar*`, `ToolbarDropdowns.tsx`, `toolbarOverflow*`)

- **Exists:** Per-pane operation toolbar with primary buttons, overflow tiers (`toolbarOverflowTier.ts`), dropdowns, customize dialog (`ToolbarCustomizeDialog.tsx`).
- **Missing:** A documented overflow priority and a single source for which command lives where.
- **Inconsistent:** Toolbar button sizing/padding differs from shared `ToolbarButton` in places; icon set mixes inline SVG (`toolbarIcons.tsx`) with the `ui/icons.tsx` set.
- **Non-premium:** Dense but slightly noisy; no clear primary/secondary visual tiering inside the strip; separators are ad-hoc.
- **Conflicts:** Menu&Modal spec §2.2 (group long menus / cap dynamic lists) — overflow exists but priority rules aren't codified.

### 3.3 Dual-pane file view (`pane/FilePanel.tsx`, `FileTable.tsx`, `FileRow.tsx`, `ColumnsView.tsx`, `styles/regions/pane.css`)

- **Exists:** Virtualized details/list/icons/columns views; column reorder + persisted widths; sort; row hover/selection tokens (`--fo-row-hover-bg`, `--fo-selection-inactive-bg`); rename inline input; git/tag badges.
- **Missing:** A strong **active vs inactive selection** distinction (active selection should use accent; inactive pane selection should be the muted `--fo-selection-inactive-bg` — verify both render distinctly per theme); standardized sort-direction indicator; drag-and-drop drop-target affordance tokens.
- **Inconsistent:** Row height keys off `--fo-row-height` (good) but column header styling and zebra/hover differ between details and columns views.
- **Non-premium:** Focus ring on rows is not unified with the global ring; DnD has limited visual feedback.
- **Conflicts:** None structural; this is polish, not redesign.

### 3.4 Path bar, breadcrumbs, drive/location selectors (`pane/PanePathBar.tsx`, `ui/BreadcrumbPath.tsx`, sidebar, `VolumePickerDialog`)

- **Exists:** Path rail (monospace), breadcrumb component, sidebar with favorites/devices/network/recent/starred, volume picker.
- **Missing:** Consistent segment hover/overflow truncation; clear "editable path" affordance.
- **Inconsistent:** Bottom path rail uses monospace; pane path bar styling differs; drive selector entry points (sidebar vs volume dialog vs breadcrumb root) aren't visually related.
- **Non-premium:** Path rail field border is hard-coded; truncation/ellipsis behavior varies.

### 3.5 Tabs (`pane/TabBar.tsx`)

- **Exists:** Per-pane tab bar.
- **Missing:** Premium active/inactive tab treatment driven by `--fo-tab-bg`/`--fo-tab-hover-bg` consistently; overflow/scroll affordance.
- **Non-premium:** Close affordance and active indicator need a designed, token-driven treatment.

### 3.6 Status bar & F-key bar (`ShellStatusBar.tsx`, `StatusBar.tsx`, `.fo-commander-bar`)

- **Exists:** 10-key commander bar with keycaps, status segments (selection, counts, readiness dot, storage gauge, log), path rail.
- **Missing:** Token-driven status-bar background (currently `--fo-statusbar-bg: #007acc` hard default); F-key labels driven from the command registry (avoid drift with actual bound actions).
- **Inconsistent:** Status bar text is forced `#ffffff` regardless of theme; readiness dot/storage gauge use mixed token + literal colors.
- **Non-premium:** F-key bar is good commander identity but keycaps need consistent contrast across themes.
- **Conflicts:** Potential **command duplication** between F-bar, toolbar, and menus — needs the §7 ownership matrix.

### 3.7 Context menus, empty/loading/error states (`menus/context/*`, `components/ContextMenu*`, `PaneStateView.tsx`)

- **Exists:** Item/empty/breadcrumb/background context-menu builders; `PaneStateView` for idle/loading/empty/error/permission states; spinner.
- **Missing:** Keyboard-navigable menus (arrow keys) are only partially done (per PROJECT_STATUS: "Specified but not implemented"); empty/error states are functional but visually plain.
- **Non-premium:** Empty/error illustrations are minimal; loading spinner is a basic border-spin.
- **Conflicts:** UI Design Spec §5 (keyboard-navigable menus) — known gap.

### 3.8 Dialogs & wizards (`dialogs/*`, `components/dialogs/*`, `components/settings/*`, `styles/regions/dialogs.css`)

- **Exists:** Conflict resolution, delete/trash confirm, rename, new folder, properties, operation history, error details, multi-rename, sync directories, connect/remove server, network locations, ACL editor, about, go-to, favorites, volume picker, session manager, plugin manager.
- **Missing:** A **shared dialog frame** (header/body/footer slots, standardized button order, danger-not-default focus rule from §3.5 of UI spec). Archive create/extract is operation-dialog-driven but lacks a true stepped wizard frame; connection setup is a single dialog rather than a guided wizard.
- **Inconsistent:** `dialogs.css` (2,984 lines) reimplements headers/footers/spacing per dialog (18+ dialog components); 39 hard-coded hex values; button ordering and primary-button placement vary.
- **Non-premium:** Some dialogs feel cramped; footers don't consistently separate destructive vs safe actions.
- **Conflicts:** Menu&Modal spec §2.4 (dangerous actions guarded, destructive not default) must be enforced uniformly.

### 3.9 Settings (`components/SettingsDialog.tsx`, `components/settings/*`)

- **Exists:** 15 settings panels (General, Display, Colors, FileList, Operations, Keyboard, Layout, LayoutProfiles, Network, Editor, Viewer, Tree, Plugins, Advanced, Terminal) with search/filter and section descriptions.
- **Missing:** A consistent settings row primitive (label + control + description), consistent control widths, and a token-driven section layout.
- **Inconsistent:** Each panel lays out controls slightly differently; keyboard-shortcut editor styling differs from other panels.
- **Non-premium:** Dense but uneven; needs a single `SettingsRow`/`SettingsGroup` layout.

### 3.10 Visual design system (`packages/ui/src/*`, `tokens.css`)

- **Exists:** Spacing/radius/elevation/height tokens; theme + accent + density + font/icon scale; shared primitives.
- **Missing:** Typography scale tokens; a focus-ring token + mixin; consumption discipline (tokens defined ≠ tokens used).
- **Inconsistent:** 164 hard-coded hex, ~190 literal font sizes, ~54 literal radii in regional CSS.
- **Non-premium:** Mixed corner language (2px vs 8–10px) and inline shadows instead of elevation tokens.

### 3.11 Product identity

- **Exists:** Strong commander DNA — dual-pane, F-key bar, dense rows, `commander-blue` retro theme, keyboard targeting.
- **Risk:** Over-modernizing (rounding everything, adding whitespace) would erode identity. The plan must **refine** the commander look (crisp 1px borders, tight radii on content, designed type) rather than soften it into a generic web app.

---

## 4. Target UI model

```
┌────────────────────────────────────────────────────────────────────────────┐
│ TITLEBAR  brand · MenuBar(File Edit View Go Tools Window Help) · status pills │  chrome L0 (recessive, token bg)
├────────────────────────────────────────────────────────────────────────────┤
│ COMMAND STRIP  Back Up Fwd Refresh │ New Copy Move Rename Trash │ View … ▾ ⋯  │  chrome L1
├─────────┬──────────────────────────────────────┬─────────────────────────────┤
│ SIDEBAR │ ACTIVE PANE (accent edge)            │ ACTIVITY / JOBS RAIL        │
│ Faves   │  ┌Tab Tab +┐                          │  running / queued / history │
│ Devices │  Path bar / breadcrumb  [filter]      │                             │
│ Network │  Name        Size  Modified  …        │                             │
│ Recent  │  ▸ file rows (dense, virtualized)     │                             │
│ Starred │                                       │                             │
│         │  INACTIVE PANE (muted selection)      │                             │
├─────────┴──────────────────────────────────────┴─────────────────────────────┤
│ PATH RAIL  local:///current/active/pane/path                                  │  chrome L1
│ F-KEY BAR  F1 Help · F2 Rename · F3 View · F4 Edit · F5 Copy · F6 Move · …     │  chrome L1 (commander)
│ STATUS BAR  • Ready   12 of 340 selected · 1.2 GB   ▮▮▮ 64% · job: copy 41%    │  chrome L0
└────────────────────────────────────────────────────────────────────────────┘
```

- **Main window:** Frameless-aware grid (already present). Chrome layers L0 (titlebar, status) recessive, L1 (toolbar, path rail, F-bar) slightly elevated. All colors from tokens.
- **Top menu:** `File Edit View Go Tools Window Help`, keyboard-accessible (alt-mnemonics already hinted via `<u>`), native Tauri menu mirrors it.
- **Toolbar / command strip:** Grouped (navigation │ operations │ view/more) with a single overflow `⋯`. Buttons are `ToolbarButton` primitives; icon-only with tooltips in compact density, icon+label in spacious.
- **Dual panes:** Active pane carries a 2px accent inset edge + accent-tinted header; inactive pane uses muted selection. Both virtualized, both density-aware.
- **Status bar:** Selection summary · size · storage gauge · active job · readiness — all token-colored, theme-correct.
- **F-key bar:** 10 keys, labels sourced from the command registry, enablement matching the active pane, keycaps token-styled per theme.
- **Context menus:** One menu frame, arrow-key navigable, grouped with separators, shortcut hints right-aligned, danger items separated.
- **Settings:** Left nav + right scroll panel; every row is `SettingsRow` (label · control · help).
- **Wizards:** Stepped frame (`WizardShell`) for Archive create/extract and Connection setup: header with step indicator, body, footer with Back/Next/Cancel/Finish.
- **Dialogs:** One `DialogShell` (header with title + close, scrollable body, footer with consistent button order: secondary/cancel left-of primary on the right; destructive visually distinct and never default-focused).

---

## 5. Detailed improvement backlog

Priorities: **P0** = blocks "premium/production-ready" claim; **P1** = strong polish; **P2** = nice-to-have. IDs prefixed `UPP-` (UI Premium Polish).

### Epic A — App shell polish

**UPP-A1 — Tokenize all chrome colors (P0)**

- _Problem:_ 93 hard-coded hex in `shell.css` (topbar `#3c3c3c`, hover `#505050`, text `#cccccc`); light theme titlebar/menubar render dark.
- _Solution:_ Replace every literal with a chrome token (`--fo-titlebar-bg`, `--fo-strip-bg`, `--fo-text`, `--fo-control-border`, plus new `--fo-chrome-hover-bg`, `--fo-chrome-active-bg`). Define them in `tokens.css` for all three themes.
- _Acceptance:_ `grep -E '#[0-9a-fA-F]{3,6}' styles/regions/shell.css` returns 0 (except documented theme palettes in `tokens.css`); titlebar/menubar correct in light, dark, commander-blue.
- _Files:_ `styles/regions/shell.css`, `packages/ui/src/tokens.css`.
- _Priority:_ **P0**

**UPP-A2 — Standard focus-ring token + utility (P0)**

- _Problem:_ Focus styling is per-component; no single ring.
- _Solution:_ Add `--fo-focus-ring: 0 0 0 2px var(--fo-focus)` and a `.fo-focusable:focus-visible` utility; apply to buttons, rows, menu items, inputs, tabs, F-keys.
- _Acceptance:_ Every interactive element shows the same ring on keyboard focus in all themes; no `outline: none` without replacement.
- _Files:_ `tokens.css`, `regions/shared.css`, primitives in `packages/ui/src/*`.
- _Priority:_ **P0**

**UPP-A3 — Chrome elevation layering (P1)**

- _Problem:_ Chrome layers are visually flat; inline shadows used elsewhere.
- _Solution:_ Define L0/L1 background + 1px border tokens; replace inline `box-shadow` with `--fo-elevation-*`.
- _Acceptance:_ Toolbar/path-rail/F-bar read as one elevated band over titlebar/status; no inline shadow literals in chrome CSS.
- _Files:_ `shell.css`, `tokens.css`.
- _Priority:_ **P1**

**UPP-A4 — Platform-aware window controls (P2)**

- _Problem:_ macOS traffic-light dots show on all platforms.
- _Solution:_ Gate window-dot vs native chrome by platform; keep frameless grid intact.
- _Acceptance:_ Windows/Linux do not show macOS dots when native decorations are used.
- _Files:_ `shell/TitleBar.tsx`, `shell.css`.
- _Priority:_ **P2**

### Epic B — Toolbar & command strip

**UPP-B1 — Single command-surface ownership matrix (P0)**

- _Problem:_ Commands duplicated across toolbar/menu/F-bar/palette/context with drift risk.
- _Solution:_ Extend the command registry (`commands/registry`) with `surfaces: { toolbar, menu, fkey, palette, context }`, canonical `label`, `icon`, `enabledWhen`. Every surface reads from it.
- _Acceptance:_ One registry drives label/icon/enablement; a test asserts no command renders with two different labels across surfaces.
- _Files:_ `commands/registry*`, `pane/toolbarActions.ts`, `shell/commanderActions.ts`, `shell/MenuBar.tsx`, `menus/context/*`.
- _Priority:_ **P0**

**UPP-B2 — Toolbar visual tiering + overflow rules (P1)**

- _Problem:_ Strip is dense but undifferentiated; overflow priority implicit.
- _Solution:_ Group navigation │ operations │ view/more with token separators; codify overflow priority in `toolbarOverflowTier.ts`; all buttons use `ToolbarButton`.
- _Acceptance:_ Groups visually separated; overflow order documented + tested; consistent button metrics.
- _Files:_ `pane/OperationToolbar.tsx`, `CommanderToolbar*`, `ToolbarButton.tsx`.
- _Priority:_ **P1**

**UPP-B3 — Unify icon set (P1)**

- _Problem:_ Inline `toolbarIcons.tsx` vs `ui/icons.tsx`.
- _Solution:_ Consolidate to one icon module, consistent 16px grid, `currentColor`.
- _Acceptance:_ Single icon source; consistent stroke/size; theme-tinted via `currentColor`.
- _Files:_ `ui/icons.tsx`, `pane/toolbarIcons.tsx`.
- _Priority:_ **P1**

### Epic C — Dual-pane file view

**UPP-C1 — Unmistakable active pane (P0)**

- _Problem:_ Active-pane cue is thin; UI spec §3.2 demands it be obvious.
- _Solution:_ Active pane gets a 2px accent inset edge + accent-tinted header + active selection in `--fo-accent`/`--fo-accent-soft`; inactive pane uses `--fo-selection-inactive-bg`.
- _Acceptance:_ Active pane unmistakable in all themes/densities; inactive selection clearly muted; verified by visual regression.
- _Files:_ `pane/FilePanel.tsx`, `PaneHeader.tsx`, `pane.css`.
- _Priority:_ **P0**

**UPP-C2 — Standardized selection/hover/focus rows (P1)**

- _Problem:_ Hover/selection/focus differ across details/columns/icons.
- _Solution:_ One row state model: hover `--fo-row-hover-bg`, selected (active) accent, selected (inactive) muted, focused row ring; applied across all views.
- _Acceptance:_ Identical state semantics across all four view modes.
- _Files:_ `pane/FileRow.tsx`, `FileTable.tsx`, `ColumnsView.tsx`, `pane.css`.
- _Priority:_ **P1**

**UPP-C3 — Sort indicator + column header polish (P1)**

- _Problem:_ Sort direction indicator inconsistent.
- _Solution:_ Token-driven ascending/descending caret in active sort column; consistent header hover.
- _Acceptance:_ Clear sort affordance; keyboard-toggle works; consistent across views.
- _Files:_ `FileTable.tsx`, `ColumnsView.tsx`, `pane.css`.
- _Priority:_ **P1**

**UPP-C4 — Drag-and-drop drop-target affordance (P2)**

- _Problem:_ DnD feedback is minimal.
- _Solution:_ Token-driven drop-target outline + insertion indicator + "copy/move" cursor hint.
- _Acceptance:_ Drop target is obvious; copy vs move communicated.
- _Files:_ `pane/FilePanel.tsx`, file-op DnD handlers, `pane.css`.
- _Priority:_ **P2**

### Epic D — Menu system

**UPP-D1 — Shared menu/popover frame (P0)**

- _Problem:_ Menus/popovers re-style inline (`box-shadow: 0 8px 20px …`).
- _Solution:_ One `MenuSurface` using `--fo-elevation-popover`, token border/bg, consistent item padding, right-aligned shortcut hints, separators, danger styling.
- _Acceptance:_ All menus (menubar dropdown, context, toolbar dropdown, help) share one frame; no inline shadow literals.
- _Files:_ `menus/context/ContextMenuPrimitives.tsx`, `components/ContextMenu.tsx`, `ui/DropdownMenu.tsx`, `shell.css`.
- _Priority:_ **P0**

**UPP-D2 — Keyboard-navigable menus (P1)**

- _Problem:_ Arrow-key navigation only partially implemented (known gap).
- _Solution:_ Roving-tabindex/arrow navigation, `Home`/`End`, type-ahead, `Esc` close, submenu open on `→`.
- _Acceptance:_ Every menu fully operable from keyboard; screen-reader roles (`menu`/`menuitem`) correct.
- _Files:_ `ContextMenuPrimitives.tsx`, `DropdownMenu.tsx`, `MenuBar.tsx`.
- _Priority:_ **P1**

**UPP-D3 — Menu grouping & dynamic-list caps (P2)**

- _Problem:_ Long dynamic lists (recent/favorites/drives) risk overflow.
- _Solution:_ Enforce Menu&Modal §2.2 caps + "Manage…" entry; grouped separators.
- _Acceptance:_ No menu exceeds cap; management dialog reachable.
- _Files:_ menu builders, relevant manage dialogs.
- _Priority:_ **P2**

### Epic E — Dialogs & modals

**UPP-E1 — Shared `DialogShell` / `DialogHeader` / `DialogFooter` (P0)**

- _Problem:_ 18+ dialogs reimplement chrome; 39 hard-coded hex in `dialogs.css`; button order varies.
- _Solution:_ Build shared dialog frame: header (title + `Esc`/close), scrollable body, footer with canonical button order (secondary left, primary right; destructive distinct, never auto-focused). Migrate dialogs onto it.
- _Acceptance:_ All dialogs share frame; `dialogs.css` hex count → 0 (tokens only); destructive buttons never default-focused (asserted by test).
- _Files:_ new `components/dialogs/DialogShell.tsx`, `dialogs.css`, all `components/dialogs/*` + `dialogs/*`.
- _Priority:_ **P0**

**UPP-E2 — Conflict & delete dialogs premium pass (P1)**

- _Problem:_ High-stakes dialogs must be clearest.
- _Solution:_ Conflict dialog: side-by-side source/dest with size/date diff, per-item + apply-to-all; delete/trash: affected count, total size, trash vs permanent clearly distinguished.
- _Acceptance:_ Matches Menu&Modal §2.4; clear, scannable, keyboard-complete.
- _Files:_ `ConflictResolutionDialog.tsx`, delete confirm path, `dialogs.css`.
- _Priority:_ **P1**

**UPP-E3 — Inputs/selects/labels primitives in dialogs (P1)**

- _Problem:_ Inputs styled per dialog.
- _Solution:_ Use `ui/Input`, a shared `Select`, and a `Field` (label + control + error) everywhere.
- _Acceptance:_ Consistent control metrics, error display, and focus across dialogs.
- _Files:_ `ui/Input.tsx`, new `ui/Select.tsx`, new `ui/Field.tsx`, dialogs.
- _Priority:_ **P1**

### Epic F — Wizards

**UPP-F1 — `WizardShell` stepped frame (P1)**

- _Problem:_ Archive/connection flows are flat dialogs, not guided wizards.
- _Solution:_ `WizardShell` with step indicator, body, Back/Next/Cancel/Finish footer, validation gating per step.
- _Acceptance:_ Reusable wizard frame; keyboard-complete; consistent with `DialogShell`.
- _Files:_ new `components/WizardShell.tsx`.
- _Priority:_ **P1**

**UPP-F2 — Archive create/extract wizard (P2)**

- _Solution:_ Steps: select items → format/options → destination/overwrite → progress. Reuse existing `createArchive`/`extractArchive` IPC (no backend change).
- _Acceptance:_ Guided flow; progress via existing job events; cancellable.
- _Files:_ archive handlers, `WizardShell`.
- _Priority:_ **P2**

**UPP-F3 — Connection setup wizard (P2)**

- _Solution:_ Steps: protocol → host/credentials → key/known-hosts (TOFU) → test connection → save. Reuse `ConnectServerDialog` logic.
- _Acceptance:_ Guided SFTP/SMB/S3 setup; host-key fingerprint confirmation step.
- _Files:_ `ConnectServerDialog.tsx`, `NetworkLocationsDialog.tsx`, `WizardShell`.
- _Priority:_ **P2**

### Epic G — Settings UI

**UPP-G1 — `SettingsRow` / `SettingsGroup` primitives (P1)**

- _Problem:_ 15 panels lay out controls differently.
- _Solution:_ Shared row (label · control · description) and group (titled section) primitives; consistent control widths.
- _Acceptance:_ All 15 panels use the primitives; consistent rhythm; search/filter still works.
- _Files:_ new `components/settings/SettingsRow.tsx` + `SettingsGroup.tsx`, all `components/settings/*`.
- _Priority:_ **P1**

**UPP-G2 — Keyboard-shortcut editor polish (P2)**

- _Solution:_ Capture-key UI with conflict detection, reset-to-default, search; consistent with settings rows.
- _Acceptance:_ Rebinding works, conflicts flagged, persisted.
- _Files:_ `SettingsKeyboard.tsx`, `ShortcutsDialog.tsx`.
- _Priority:_ **P2**

### Epic H — Theme & typography

**UPP-H1 — Typography scale tokens (P0)**

- _Problem:_ ~190 literal font sizes; no scale.
- _Solution:_ Add `--fo-font-size-xs/sm/md/lg/xl` (e.g. 10/11/12/13/15 base, density-aware) + `--fo-line-*`; replace literals.
- _Acceptance:_ `grep 'font-size: [0-9]' regions/*.css` → near 0; hierarchy keyed to scale.
- _Files:_ `tokens.css`, all `regions/*.css`.
- _Priority:_ **P0**

**UPP-H2 — Radius scale enforcement (P1)**

- _Problem:_ 2/3/4/6/7/8/10px radii mixed.
- _Solution:_ Two content radii: `--fo-radius-xs: 2px` (commander content/inputs/keycaps), `--fo-radius-sm: 6px` (popovers/dialogs); pills `999px`. Replace literals.
- _Acceptance:_ Only token radii used; commander crispness preserved (content stays 2px).
- _Files:_ `tokens.css`, `regions/*.css`.
- _Priority:_ **P1**

**UPP-H3 — Light & commander-blue parity audit (P0)**

- _Problem:_ Light theme broken in chrome; commander-blue maintained via duplication.
- _Solution:_ After A1/H1, audit all three themes for contrast and correctness; remove now-redundant `.fo-shell` re-declarations where tokens suffice.
- _Acceptance:_ All three themes pass a screenshot review across shell + key dialogs.
- _Files:_ `tokens.css`, `shell.css`.
- _Priority:_ **P0**

### Epic I — Accessibility

**UPP-I1 — Dialog/menu ARIA + focus management (P0)**

- _Problem:_ Inconsistent roles/focus trapping.
- _Solution:_ `role="dialog"`+`aria-modal`, focus trap, restore-on-close, `Esc`; menus `role="menu"`/`menuitem`; live region for job/toast announcements.
- _Acceptance:_ Axe clean for dialogs/menus; screen-reader announces open/close and job updates.
- _Files:_ `DialogShell`, menu primitives, `ToastStack.tsx`, jobs.
- _Priority:_ **P0**

**UPP-I2 — Contrast & reduced motion (P1)**

- _Solution:_ Verify WCAG AA for text/icons in all themes; honor `prefers-reduced-motion` for spinners/transitions.
- _Acceptance:_ AA met; motion reduced when requested.
- _Files:_ `tokens.css`, `density.css`, animated components.
- _Priority:_ **P1**

### Epic J — Motion & micro-interactions

**UPP-J1 — Motion tokens (P2)**

- _Solution:_ `--fo-motion-fast: 120ms`, `--fo-motion-med: 200ms`, standard easing; apply to hover/menu/dialog transitions; all gated by reduced-motion.
- _Acceptance:_ Consistent, subtle motion; zero motion when reduced.
- _Files:_ `tokens.css`, components.
- _Priority:_ **P2**

### Epic K — QA & regression

**UPP-K1 — Visual regression matrix (P0)**

- _Solution:_ Snapshot key surfaces (shell, active/inactive pane, each dialog, each menu) × 3 themes × 3 densities.
- _Acceptance:_ CI catches theme/token regressions.
- _Files:_ `packages/frontend/tests/*`, visual harness.
- _Priority:_ **P0**

**UPP-K2 — Token-lint guard (P1)**

- _Solution:_ Lint/test failing on new hard-coded hex/font-size/radius literals in `regions/*.css` (allowlist `tokens.css`).
- _Acceptance:_ CI blocks regressions to non-token styling.
- _Files:_ lint config, CI.
- _Priority:_ **P1**

---

## 6. Component-level recommendations

- **Buttons (`ui/Button`):** Variants `default | primary | ghost | danger`, sizes `sm | md`. Height from control-height token; radius `--fo-radius-xs`; 1px token border; focus uses standard ring; hover via `--fo-chrome-hover-bg`. Primary = accent bg + `--fo-on-accent`. Danger never auto-focused in dialogs.
- **Icon buttons (`ui/IconButton`):** Square, 16px icon on control-height; tooltip required (accessible name); same ring/hover as Button.
- **Split buttons:** Primary action + caret zone with 1px divider; caret opens `MenuSurface`; both halves keyboard-reachable; used for "New ▾", "Copy to ▾".
- **Menu items:** Single row height, leading icon slot, label, right-aligned shortcut hint in `--fo-muted-text`; hover/focus = accent-soft; separators 1px token; danger item in `--fo-danger`; disabled in `--fo-disabled-text` with tooltip.
- **Dialog headers:** Title (label weight 600, `--fo-font-size-lg`), optional subtitle muted, close button (`Esc`); 1px bottom divider; token bg.
- **Dialog footers:** Right-aligned actions, order secondary→primary; destructive separated/left or visually distinct, never default; 1px top divider; consistent padding from spacing scale.
- **Inputs (`ui/Input`):** Control-height, token bg/border, focus ring, `--fo-radius-xs`; error state uses `--fo-danger-border` + message; placeholder `--fo-muted-text`.
- **Selects/dropdowns:** Match Input metrics; open into `MenuSurface`; keyboard select; selected item checkmark.
- **Tabs (`pane/TabBar`):** Active = `--fo-tab-bg` + accent underline/edge; inactive recessive, hover `--fo-tab-hover-bg`; close affordance on hover/focus; overflow scroll.
- **Tables / file lists:** Row height from `--fo-row-height`; header recessive with sort caret; hover/selection/focus per UPP-C2; minimal horizontal padding (commander density); virtualization preserved.
- **Breadcrumbs (`ui/BreadcrumbPath`):** Segment hover, overflow collapse with `…` menu, root = drive/location; editable-path affordance; monospace optional for path rail only.
- **Progress indicators:** Determinate bar uses `--fo-accent`; indeterminate honors reduced motion; job rows show name + percent + cancel/pause; consistent with status-bar mini-progress.
- **Toasts/notifications (`ToastStack`):** Token bg + `--fo-elevation-popover`; role status/alert; auto-dismiss with pause-on-hover; success/warn/danger variants from tokens; stack width from `--fo-toast-width`.
- **Empty states (`PaneStateView`):** Centered, restrained icon + one-line explanation + a primary action (e.g., "New Folder", "Show hidden"); distinct visuals for empty vs error vs permission-denied; no raw error dumps (link to Error Details).

---

## 7. Commander-style interaction requirements

- **Active pane:** Exactly one pane is active. It owns all menu/toolbar/F-key/global-shortcut/paste commands (UI spec §3.2). Switching panes (`Tab`, click, or focus) updates the accent edge, header tint, status-bar "active side", and command targeting atomically.
- **Keyboard focus:** Focus is always visible (standard ring). Within a pane, arrows move the cursor row, `Shift+Arrow` extends selection, `Space`/`Insert` toggles selection (commander convention), `Ctrl+A` select-all. Region order: sidebar → active pane → activity rail via `Tab`.
- **Function-key bar:** F1 Help, F2 Rename, F3 View, F4 Edit, F5 Copy, F6 Move, F7 New Folder, F8 Delete/Trash, F9 menu/options, F10 Quit/menu — labels and enablement **sourced from the command registry** (UPP-B1) so the bar never drifts from the actual bindings. Keys reflect active-pane state (e.g., F5/F6 disabled with no selection).
- **Command strip:** High-frequency active-pane actions only; grouped navigation │ operations │ view/more; overflow `⋯`. Does **not** duplicate the F-bar's role — toolbar is mouse-first discovery, F-bar is keyboard muscle memory; both read the same registry but present for different inputs (acceptable, intentional, non-divergent).
- **Selection:** Distinct active-pane selection (accent) vs inactive-pane selection (muted). Multi-select via Shift/Ctrl and keyboard; selection count + size always in status bar.
- **Context menus:** Right-click targets the item/selection/background/breadcrumb/sidebar entry that opened it (Menu&Modal §2.5); selects the item first if needed; arrow-navigable; grouped; danger separated.
- **Copy/move flow:** Source = active pane selection; default destination = the _other_ pane's current folder (classic commander), overridable via destination chooser. Operation becomes a planned job with progress, cancel/pause, history row (per ADR-0002; no direct FS).
- **Conflict resolution:** On plan-time conflicts, show the conflict dialog with per-item source/dest comparison and Overwrite/Skip/Rename/Keep-both + apply-to-all; destructive (overwrite) never default-focused; choices feed back into the job.

---

## 8. Premium visual polish requirements

### 8.1 Spacing scale (exists — enforce)

`--fo-spacing-xs:2 / sm:4 / md:8 / lg:12 / xl:16 / 2xl:24`. Chrome padding and dialog rhythm use these exclusively; file-row horizontal padding stays minimal for density.

### 8.2 Typography scale (new — UPP-H1)

`--fo-font-size-xs:10 / sm:11 / md:12 / lg:13 / xl:15` (density-aware), `--fo-line-tight/normal`. Weights: 400 body, 600 emphasis/labels, 700–800 keycaps/badges only. Status bar / path rail keep monospace; everything else `--fo-base` family.

### 8.3 Icon sizing

Single 16px grid (`--fo-icon-size`, scalable via `data-icon-scale`); `currentColor`; consistent stroke; one icon module.

### 8.4 Border usage

1px borders from `--fo-border` / `--fo-strong-border` / `--fo-subtle-border`; commander crispness via 1px dividers, not shadows; no 2px+ decorative borders except the active-pane accent edge.

### 8.5 Elevation / shadow

Only `--fo-elevation-popover/modal/drawer`; no inline `box-shadow` literals. Chrome uses border+bg layering, not drop shadows.

### 8.6 Color token usage

Roles only: text (`--fo-text/secondary/muted/disabled`), surfaces (`--fo-app-bg/workspace-bg/surface/surface-elevated/strip-bg`), accent, status (`success/warning/danger`). No raw hex in component CSS.

### 8.7 Theme token naming

Keep the `--fo-*` namespace. New tokens follow existing patterns: `--fo-font-size-*`, `--fo-chrome-hover-bg`, `--fo-chrome-active-bg`, `--fo-focus-ring`, `--fo-motion-*`. Document each in `tokens.css` with a comment + spec section reference.

### 8.8 Light & dark (and commander-blue) requirements

All three are first-class. A change ships only when verified in light, dark, commander-blue × compact/comfortable/spacious. Light theme must have correct (light) chrome; commander-blue keeps its retro identity but draws from tokens, not duplicated literals.

---

## 9. Accessibility requirements

- **Keyboard navigation:** 100% mouse parity; region `Tab` order; arrow nav in panes and menus; documented shortcuts via Shortcuts dialog.
- **Focus visibility:** Standard ring on every interactive element; never removed without replacement.
- **ARIA roles:** Dialogs `role="dialog"` + `aria-modal` + labelled title; menus `role="menu"`/`menuitem`; tabs `role="tablist"`/`tab`; toasts `role="status"`/`alert`; tables use proper grid/row semantics.
- **Contrast:** WCAG AA for text and meaningful icons in all three themes (special attention to commander-blue cyan-on-blue and muted text).
- **Reduced motion:** `prefers-reduced-motion` disables spin/transition; provide static progress.
- **Screen reader:** Dialog open/close announced; focus moves into dialog and restores on close; job progress and toasts announced via live regions; menu open/active item announced.

---

## 10. Implementation phases

- **Phase 1 — Audit & design tokens (P0 foundation):** UPP-H1 (typography), UPP-A1 (chrome tokenization), UPP-A2 (focus ring), UPP-H2/H3 (radius + theme parity), UPP-K2 (token-lint guard). _Outcome:_ tokens defined and consumed; themes correct.
- **Phase 2 — App shell & command strip:** UPP-A3, UPP-B1 (ownership matrix), UPP-B2/B3. _Outcome:_ coherent chrome, no command drift.
- **Phase 3 — File panes & status/F-bar:** UPP-C1 (active pane), UPP-C2/C3, status-bar + F-bar tokenization. _Outcome:_ unmistakable commander panes.
- **Phase 4 — Menus & context menus:** UPP-D1 (menu frame), UPP-D2 (keyboard nav), UPP-D3. _Outcome:_ one menu system, fully keyboard-operable.
- **Phase 5 — Dialogs, wizards & settings:** UPP-E1/E2/E3, UPP-F1/F2/F3, UPP-G1/G2. _Outcome:_ one dialog/wizard frame; uniform settings.
- **Phase 6 — QA, accessibility & regression:** UPP-I1/I2, UPP-J1, UPP-K1. _Outcome:_ AA + visual regression coverage locks the finish in.

Each phase ends with a verification gate: `pnpm typecheck && pnpm lint && pnpm test`, plus visual review across 3 themes × 3 densities.

---

## 11. QA checklist

**Automated**

- [ ] Token-lint: zero new hex/font-size/radius literals in `regions/*.css`.
- [ ] Registry test: no command renders with divergent labels across surfaces.
- [ ] Dialog test: destructive button never `autoFocus`/default.
- [ ] Visual regression: shell + each dialog + each menu × 3 themes × 3 densities.
- [ ] Axe: dialogs and menus clean.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` green.

**Manual — main window**

- [ ] Active pane unmistakable; switching updates edge/header/status/targeting.
- [ ] Light, dark, commander-blue chrome all correct (titlebar/menubar/toolbar/F-bar/status).
- [ ] Density compact/comfortable/spacious legible, no overlap/clipping.

**Manual — menus**

- [ ] Every menu fully keyboard-operable (arrows, Home/End, type-ahead, Esc, → submenu).
- [ ] Shortcut hints match actual bindings; disabled items show reason.

**Manual — dialogs/wizards**

- [ ] Focus traps + restores; Esc closes; consistent header/footer/button order.
- [ ] Conflict/delete dialogs show counts/sizes; destructive not default-focused.
- [ ] Archive + connection wizards step/validate/cancel correctly.

**Manual — keyboard**

- [ ] F1–F10 do the labeled action against the active pane.
- [ ] Copy/move defaults to the opposite pane; conflicts resolve via dialog.

**Manual — theme/resize/a11y**

- [ ] Theme switch updates every surface live.
- [ ] Window resize → responsive breakpoints behave (narrow/medium/wide).
- [ ] `prefers-reduced-motion` honored; screen reader announces dialogs/jobs.

**Cross-platform (Tauri WebView)**

- [ ] Windows (WebView2), macOS (WKWebView), Linux (WebKitGTK): fonts, focus rings, backdrop blur, scrollbars, and window controls render acceptably; no platform-only breakage.

---

## 12. Risks & constraints

- **Over-modernizing → lost identity.** Mitigation: keep content radius at 2px, keep dense rows and the F-key bar, keep commander-blue; "premium" means crisp + token-correct, not rounded + airy.
- **Polish reducing density.** Mitigation: all sizing keys off density tokens; file-row padding floor enforced; no whitespace inflation in panes.
- **Command duplication across surfaces.** Mitigation: the §7 + UPP-B1 ownership matrix; toolbar vs F-bar duplication is intentional (different input modes) but must share one registry — enforced by test.
- **Inconsistent modal behavior.** Mitigation: single `DialogShell`/`WizardShell`; behavior (focus/Esc/order) enforced centrally + tested.
- **Poor keyboard navigation.** Mitigation: UPP-D2/I1 make menus and dialogs fully keyboard-operable; covered by manual + axe checks.
- **Platform WebView rendering differences.** Mitigation: cross-platform QA row; avoid effects (heavy backdrop blur) that diverge across WebView2/WKWebView/WebKitGTK; prefer border+bg layering over shadows.
- **Scope creep vs RC.** Mitigation: P0 set (tokenization, focus ring, active pane, dialog frame, theme parity, a11y, visual regression) is the "production-ready" bar; P1/P2 are incremental and can trail into a later sprint.

---

## Appendix — Evidence snapshot (2026-05-30)

- Hard-coded hex in regional CSS: **164** total — `shell.css` 93, `dialogs.css` 39, `shared.css` 12, `jobs.css` 10, `sidebar.css` 9 (`pane.css`/`paneTerminal.css` already token-clean).
- Literal `font-size: NNpx` in regional CSS: **192** (12px ×75, 11px ×56, 13px ×27, 10px ×19, …) — no type scale.
- Literal `border-radius` values: 2/3/4/6/7/8/10/999px mixed.
- Tokens already present and under-consumed: `--fo-spacing-*`, `--fo-radius-*`, `--fo-elevation-*`, height tokens, density modes, 3 themes, 7 accents.
- Surfaces inventory: 18 dialog components (`components/dialogs/*`) plus shell-level dialogs (`dialogs/*`, `SettingsDialog`, `MultiRenameDialog`, …), 15 settings panels (`components/settings/*`), shared `ui/*` primitives, 4 context-menu builders, command palette, toasts, viewer/editor, commander F-key bar, status/path rail.
  </content>
  </invoke>
