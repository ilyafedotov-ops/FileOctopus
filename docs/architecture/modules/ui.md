# `@fileoctopus/ui` — Shared UI primitives

`packages/ui` is the home for cross-package React primitives, icons, class-name helpers, and shared design-token CSS. `@fileoctopus/frontend` consumes it broadly for buttons, toolbar controls, menus, breadcrumbs, search inputs, icons, and shared CSS entry points.

- Source: `packages/ui/src/index.tsx`
- Depends on: `react` (peer).
- Used by: `@fileoctopus/frontend` and `apps/desktop-tauri/src/App.tsx` style imports. The package is part of the `pnpm dev` build chain (built after `ts-api`, before `frontend`) so workspace consumers have a stable primitive layer.

## Public surface

The package exports shared primitives such as `Button`, `IconButton`, `ToolbarButton`, `DropdownMenu`, `MenuSurface`, `SearchInput`, `BreadcrumbPath`, `Icons`, `cx`, and `fileEntryIcon`. It also exposes `tokens.css` and `components.css` for the desktop shell to import once.

## Why a separate package

The package earns its keep for two reasons:

1. **Lower bar for cross-shell reuse.** Shared primitives can be reused without importing the full product shell in `@fileoctopus/frontend`.
2. **Stable design tokens.** Centralizing tokens and common component frames keeps menus, dialogs, toolbars, and controls visually coherent across feature work.

## Conventions

- **Stateless, presentational only.** Components here must not manage state or perform IPC. If you find yourself reaching for `useState` or `@fileoctopus/ts-api`, the component belongs in `@fileoctopus/frontend`.
- **CSS entry points stay explicit.** Consumers import `@fileoctopus/ui/tokens.css` and `@fileoctopus/ui/components.css` once at the app boundary.
- **Forward refs and props.** Future primitives should accept standard HTML props (`...rest`) so consumers can wire ARIA attributes and event handlers without wrappers.
- **Tree-shakeable exports.** Add each component as a named export; do not introduce default exports or barrel files that defeat tree shaking.

## Tests

Tests live under `packages/ui/tests/*.test.tsx` (Vitest + `@testing-library/react`).

Run with `pnpm --filter @fileoctopus/ui test`.

## Build

`pnpm --filter @fileoctopus/ui build` compiles `src/index.tsx` to `dist/` via `tsc`. The `package.json` `exports` entry points at the source (`./src/index.tsx`) so workspace consumers get the .tsx directly; the `main`/`types` paths are for downstream tooling that needs a compiled artifact.
