# `@fileoctopus/ui` — Shared UI primitives

`packages/ui` is the home for cross-package React primitives. Today it contains only one component, `ShellPanel`, but the package exists to give future shared UI a place to live without forcing every consumer to depend on the full product shell in `@fileoctopus/frontend`.

- Source: `packages/ui/src/index.tsx`
- Depends on: `react` (peer).
- Used by: future product surfaces. **Not currently consumed by `@fileoctopus/frontend`** — the frontend renders its own panel chrome inline. The package is part of the `pnpm dev` build chain (built after `ts-api`, before `frontend`) to keep the dependency graph honest.

## Public surface

```tsx
export interface ShellPanelProps {
  title: string;
  active?: boolean;
  children?: ReactNode;
}

export function ShellPanel({
  title,
  active = false,
  children,
}: ShellPanelProps): JSX.Element;
```

Renders a `<section>` with the `fo-panel` / `fo-panel-active` class names (matching the styling in `apps/desktop-tauri/src/App.css`) and a small header that shows the title and `Ready` / `Active` state.

## Why a separate package

Two reasons it earns its keep even at one component:

1. **Lower bar for cross-shell reuse.** When a CLI inspection UI or a settings shell is added, it can pull in `ShellPanel` (and future siblings) without inheriting the React 19 + Vitest stack of `@fileoctopus/frontend`.
2. **Stable design tokens.** Centralizing class names like `fo-panel-active` here makes it easier to keep the design system coherent. Today the names are hardcoded; the long-term plan is to thread them through a small token export.

## Conventions

- **Stateless, presentational only.** Components here must not manage state or perform IPC. If you find yourself reaching for `useState` or `@fileoctopus/ts-api`, the component belongs in `@fileoctopus/frontend`.
- **No global CSS imports.** Class names are emitted as strings; styles live in the consuming app (today: `apps/desktop-tauri/src/App.css`).
- **Forward refs and props.** Future primitives should accept standard HTML props (`...rest`) so consumers can wire ARIA attributes and event handlers without wrappers.
- **Tree-shakeable exports.** Add each component as a named export; do not introduce default exports or barrel files that defeat tree shaking.

## Tests

No co-located tests today. Tests will live under `packages/ui/tests/*.test.tsx` (Vitest + `@testing-library/react`) when the package grows.

Run with `pnpm --filter @fileoctopus/ui test`.

## Build

`pnpm --filter @fileoctopus/ui build` compiles `src/index.tsx` to `dist/` via `tsc`. The `package.json` `exports` entry points at the source (`./src/index.tsx`) so workspace consumers get the .tsx directly; the `main`/`types` paths are for downstream tooling that needs a compiled artifact.
