# Limbus Story Reader

This repository keeps a local copy of Limbus Company localization data and provides a static story viewer for browsing story, identity, and voice dialogue across Chinese, Japanese, English, and Korean.

The viewer is intentionally simple: there is no build tool, package manager, or backend service. A Node.js script generates a JSON manifest, and a small static server serves the workspace so the browser can fetch both `story-viewer/` assets and `LocalizeLimbusCompany/` data files.

## Quick Start

Run these commands from the workspace root:

```powershell
node LocalizeLimbusCompany/scripts/build-story-index.mjs
node LocalizeLimbusCompany/scripts/serve-story-viewer.mjs
```

Then open:

```text
http://localhost:4173/story-viewer/
```

Use `PORT=4174` or another value if port `4173` is already in use.

## Repository Layout

```text
LocalizeLimbusCompany/          Localization data mirror and utility scripts
  EN/ JP/ KR/ LLC_zh-CN/        Language folders consumed by the viewer
  Assets/StoryIcons/            Speaker portrait assets used by story pages
  scripts/
    build-story-index.mjs       Generates story-viewer/data/story-index.json
    serve-story-viewer.mjs      Local static server rooted at workspace root
    sync-upstream-localizations.ps1
    register-localization-sync-task.ps1
story-viewer/                   Static browser UI
  index.html                    Catalog page
  app.js                        Catalog filtering and routing logic
  story.html                    Story detail shell
  story.js                      Story loading, row alignment, dialogue rendering
  styles.css                    Shared catalog/detail styling
  data/story-index.json         Generated manifest, not hand-authored
patch*.mjs, patch_sort.txt      Historical one-off patch helpers
docs/                           Architecture and maintenance notes
```

## Main Data Flow

1. `build-story-index.mjs` scans each language folder for `StoryData/*.json` and `PersonalityVoiceDlg/*.json`.
2. It parses each file code into category, chapter, stage, labels, sort keys, and language availability.
3. It enriches labels from stage/chapter/personality metadata files.
4. It writes `story-viewer/data/story-index.json`.
5. `story-viewer/index.html` loads the manifest and links to `story.html?code=<storyCode>&langs=<languageIds>`.
6. `story-viewer/story.js` loads the selected story files, aligns rows by dialogue id or fallback index, and renders per-line language controls.

## Important Development Notes

- Regenerate [story-viewer/data/story-index.json](story-viewer/data/story-index.json) after changing localization data, naming rules, categories, title enrichment, or language availability.
- The story detail page currently supports per-line language toggles. Do not remove this behavior when optimizing rendering.
- The detail page may be slow for long chapters because it can load and render four language versions for every line. See [docs/architecture.md](docs/architecture.md) for the current performance model.
- `sync-upstream-localizations.ps1` is a local automation script. It can create commits and push to the configured remote when run by the scheduled task, so review it before enabling on another machine.

## Testing

Use the root npm scripts for validation:

```powershell
npm run test:syntax
npm run test:unit
npm run test:e2e
```

See [docs/testing.md](docs/testing.md) for unit and end-to-end test rules.

## More Documentation

- [docs/architecture.md](docs/architecture.md): module responsibilities, manifest schema, rendering flow, and performance constraints.
- [docs/maintenance.md](docs/maintenance.md): common commands, validation steps, upstream sync workflow, and known sharp edges.
- [docs/testing.md](docs/testing.md): unit and end-to-end testing commands and rules.
- [story-viewer/README.md](story-viewer/README.md): viewer-specific usage notes.