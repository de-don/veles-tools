# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Veles Tools is a Chrome browser extension (Manifest V3) for the [veles.finance](https://veles.finance/) crypto trading platform. It provides backtest multi-launching, result aggregation, active deals monitoring, dynamic position block management, and bot import/clone. All data stays local in the browser (localStorage + IndexedDB). The UI language is Russian.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Vite build in watch mode (`extension/ui/dist`) |
| `npm run build` | Production build |
| `npm run lint` | Biome check (lint + format) |
| `npm run lint:fix` | Biome check with auto-fix |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest single run |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Vitest with v8 coverage |

Run a single test file: `npx vitest run --config extension/ui/vitest.config.ts extension/ui/src/path/to/file.test.ts`

**Always run `npm run typecheck` and `npm run build` after completing a task.**

## Tech Stack

React 18, TypeScript (strict), Vite 5 (SWC plugin), Ant Design 5, ECharts 5, react-router-dom v7 (HashRouter), Biome 2, Vitest 2 (jsdom), Chrome Extension Manifest V3. Node >=22 <23, npm >=10.

## Architecture

### Layered structure (`extension/ui/src/`)

- **`api/`** — Raw transport only. Works exclusively with `...Dto` interfaces that mirror backend responses exactly. No caching, data massaging, or business logic. Uses `proxyHttpRequest` to send requests through the extension background service worker.
- **`services/`** — Business logic layer. Consumes API DTOs, maps them into domain entities (Dto suffix removed), encapsulates caching, aggregation, and pagination.
- **`types/`** — Domain type definitions consumed by UI code (no Dto suffix).
- **`storage/`** — Persistent state. Simple preferences via `safeStorage.ts` (localStorage). Heavy data via `indexedDb.ts` (IndexedDB).
- **`context/`** — React Context providers (state management, no Redux/Zustand). Providers composed in `App.tsx`.
- **`lib/`** — Shared utilities. **When adding/modifying helpers here, update `extension/ui/src/lib/README.md`.**
- **`components/`** — UI components. Subdirectories: `backtests/`, `bots/`, `charts/`, `ui/` (reusable primitives).
- **`pages/`** — Route-level page components.

### Extension scripts (`extension/scripts/`)

- `background.js` — Service worker: request queue, proxy, connection management between UI and veles.finance tab.
- `proxy-bridge.js` — Content script injected into veles.finance pages.
- `page-fetch-bridge.js` — Web-accessible page-level fetch bridge.

## Coding Conventions

- Strict typing; avoid `any`/`unknown` unless well-documented. `noExplicitAny` is only disabled in test files.
- DTO interfaces mirror backend responses exactly — never alter DTO shapes for convenience; derive separate domain types.
- Use Ant Design `Select` components for filters (not native selects).
- One-time modals: guard display with `readStorageValue`/`writeStorageValue`.
- Styling: global CSS with BEM naming, CSS custom properties, dark/light theme via `data-theme` attribute.
- Conventional Commits: `feat(scope):`, `fix(scope):`, `chore:`.

## Formatting (Biome)

Indent: 2 spaces. Line width: 120. Single quotes. Import organizing enabled.

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`): typecheck → test → build → release (main branch only via Semantic Release).
