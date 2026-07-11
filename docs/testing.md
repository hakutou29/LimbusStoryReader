# Testing Guide

This project uses two test layers:

- Unit tests use Node's built-in `node:test` runner and cover pure JavaScript logic.
- End-to-end tests use Playwright and cover browser-visible story viewer flows.

## Commands

Install dependencies once:

```powershell
npm install
npx playwright install chromium
```

Run syntax checks:

```powershell
npm run test:syntax
```

Run unit tests:

```powershell
npm run test:unit
```

Run browser tests:

```powershell
npm run test:e2e
```

Run everything:

```powershell
npm test
```

## Unit Test Rules

- Put small, deterministic tests under `tests/unit/`.
- Prefer testing pure modules instead of importing browser entry files directly.
- Keep tests state-based: assert returned rows, labels, escaped text, and manifest fields rather than internal call order.
- Add or update unit tests before changing story alignment, rich text formatting, story code parsing, or generated manifest rules.

## E2E Test Rules

- Put Playwright specs under `tests/e2e/`.
- Cover critical user flows only: catalog load/search, opening a detail page, global language switching, and per-line language switching.
- Prefer role and label locators. Use stable data attributes or local structural selectors only where the current UI lacks accessible names.
- Do not use arbitrary waits. Rely on Playwright auto-waiting and visible state assertions.
- Keep tests independent; each test should open its own page and choose its own story data from `story-index.json`.

## Artifacts

Playwright traces, screenshots, videos, and HTML reports are written under `test-results/` and `playwright-report/`. These paths are ignored by Git.