# Maintenance Guide

This guide is for humans and coding agents maintaining the story viewer and localization sync flow.

## Common Commands

Run from the workspace root.

Regenerate the story manifest:

```powershell
node LocalizeLimbusCompany/scripts/build-story-index.mjs
```

Start the local viewer:

```powershell
node LocalizeLimbusCompany/scripts/serve-story-viewer.mjs
```

Use another port:

```powershell
$env:PORT = '4174'
node LocalizeLimbusCompany/scripts/serve-story-viewer.mjs
```

Check JavaScript syntax without running the browser:

```powershell
node --check story-viewer/app.js
node --check story-viewer/story.js
node --check LocalizeLimbusCompany/scripts/build-story-index.mjs
node --check LocalizeLimbusCompany/scripts/serve-story-viewer.mjs
```

Validate localization JSON for the four viewer languages:

```powershell
$ErrorActionPreference = 'Stop'
foreach ($dir in @('LLC_zh-CN','JP','EN','KR')) {
  Get-ChildItem (Join-Path 'LocalizeLimbusCompany' $dir) -Recurse -Filter '*.json' |
    ForEach-Object { Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json | Out-Null }
}
```

## Editing Localization Data

After changing files under any of these folders, regenerate the manifest:

- `LocalizeLimbusCompany/LLC_zh-CN/`
- `LocalizeLimbusCompany/JP/`
- `LocalizeLimbusCompany/EN/`
- `LocalizeLimbusCompany/KR/`

Then run the viewer and spot-check:

- Catalog loads.
- Search finds the changed code/title.
- Detail page opens.
- Language availability pills are correct.
- Global language toggles update the query string.
- Per-line language toggles still work independently.

## Editing Index Rules

Most catalog behavior is controlled by [LocalizeLimbusCompany/scripts/build-story-index.mjs](../LocalizeLimbusCompany/scripts/build-story-index.mjs).

When editing parsing or sorting rules:

1. Update `parseStoryCode(fileCode)`.
2. Update `categorySort` if a category is added or reordered.
3. Confirm `searchText` includes the terms users will search.
4. Regenerate [story-viewer/data/story-index.json](../story-viewer/data/story-index.json).
5. Spot-check the catalog grouping and sort order.

Code families currently handled:

- `S...`: main story.
- `E...`: interval, Walpurgis, April Fools, and other event-like stories.
- `ES...`: interval lecture story entries.
- `PC...`: Arknights collaboration.
- `P...`: identity story.
- `V...`: personality voice, generated from `PersonalityVoiceDlg` files.
- `<number>D...`: dungeon-style main-story addenda.

## Editing Story Detail Rendering

The detail page lives mostly in [story-viewer/story.js](../story-viewer/story.js).

Protect these behaviors:

- A detail URL must be shareable with `code` and `langs` query parameters.
- At least one global language remains selected.
- Every line keeps its own local language checkbox group.
- Local per-line language toggles must not force a full page rerender.
- Missing aligned language rows should render a missing-language card rather than silently disappearing.
- Rich text tags from source data should be escaped first, then selectively restored by `formatRichText()`.

Known performance issue:

- Current rendering eagerly creates blocks for all core languages per line. Long stories can generate more than 1,000 cards on load. Prefer lazy per-row language block creation when optimizing.

Known correctness issue:

- `buildMergedRows()` references `selectedLangsArray`, which is not defined. Fix this before relying on the `id === -1` Korean-row filtering branch.

## Editing Styles

Shared styling is in [story-viewer/styles.css](../story-viewer/styles.css).

Guidelines:

- Reuse existing CSS variables in `:root`.
- Keep repeated card containers on `.shell-panel` and dialogue rows on `.dialogue-card`.
- For mobile changes, check both normal story dialogue and personality voice dialogue.
- Preserve `.dialogue-card-voice` mobile one-column behavior.
- Watch for `min-width` and grid column interactions; mobile overlap bugs have happened when children could not shrink.

## Upstream Localization Sync

The upstream repository is:

```text
https://github.com/LocalizeLimbusCompany/LocalizeLimbusCompany.git
```

Manual sync pattern:

1. Mirror upstream `LLC_zh-CN`, `JP`, `EN`, and `KR` into `LocalizeLimbusCompany/`.
2. Validate JSON.
3. Regenerate `story-viewer/data/story-index.json`.
4. Review `git diff --stat` and changed paths.
5. Commit and push only when intended.

The local automation scripts are:

- [LocalizeLimbusCompany/scripts/sync-upstream-localizations.ps1](../LocalizeLimbusCompany/scripts/sync-upstream-localizations.ps1)
- [LocalizeLimbusCompany/scripts/register-localization-sync-task.ps1](../LocalizeLimbusCompany/scripts/register-localization-sync-task.ps1)

The scheduled sync task checks a local state file under `.git/` and uses this cadence:

- After a successful upstream update, check again next Friday.
- If no upstream change is found, check again the next day.

Important:

- The sync script refuses to run on a dirty worktree.
- When it detects real changes, it commits and pushes to the current branch's `origin` remote.
- The schedule state and logs live under `.git/` and are not committed.
- The scheduled task itself is machine-local Windows state and is not represented by Git.

## Git State Caution

This workspace may have local-only commits for machine setup, such as the scheduled sync task scripts. Before pushing unrelated changes, check:

```powershell
git status --short --branch
git log --oneline origin/main..HEAD
```

If a local-only commit must not be pushed, push the intended fix from a branch based on `origin/main`, then rebase the local-only commit afterward.

## Validation Checklist

Use the narrowest checks that match the change.

For documentation-only changes:

```powershell
git diff --check
```

For viewer JavaScript changes:

```powershell
node --check story-viewer/app.js
node --check story-viewer/story.js
```

For index-builder changes:

```powershell
node --check LocalizeLimbusCompany/scripts/build-story-index.mjs
node LocalizeLimbusCompany/scripts/build-story-index.mjs
```

For data sync changes:

```powershell
node LocalizeLimbusCompany/scripts/build-story-index.mjs
```

Then run the local server and manually check at least one catalog page and one detail page.

## Historical Patch Helpers

The root-level `patch.mjs`, `patch_D.mjs`, and `patch_sort.txt` are historical one-off helpers used to modify the index builder. Treat them as references, not part of the regular workflow. Prefer direct, reviewed edits to `build-story-index.mjs` for future changes.