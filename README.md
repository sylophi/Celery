# Celery

Dependency-aware mod manager for [Celeste](https://www.celestegame.com/) /
[Everest](https://everestapi.github.io/). Instead of a flat list, Celery shows
each mod grouped with the helpers it pulls in, and toggling a mod carries its
dependency closure with it.

Celery reads and writes Everest's own files (`blacklist.txt`, `favorites.txt`,
the `everest.yaml` manifests inside each mod zip), so the in-game Toggle Mods
menu, Olympus, and Celery always agree. It keeps no parallel state about your
mods.

## Features

- **Three views** over the same mods, switched from the toolbar: the dependency
  graph, a grid of cover art for finding something by sight, and a dense list
  with the columns you would otherwise open each mod to compare.
- **Dependency graph**: every top-level mod sits in its own island with the
  helpers only it uses; helpers several mods share move to a shelf below,
  labelled with how many mods want them. Select a mod and the view reshapes
  around it: what needs it above, what it needs below, arrows and all.
  A typical folder has a handful of collabs pulling in most of a shared pool,
  so drawing every edge at once says nothing; they are drawn where they carry
  something.
- **Cascading toggles**: enabling a map enables its helpers; disabling a helper
  takes down everything enabled that would break without it. Cascades apply
  immediately; a setting turns on preview-before-write.
- **Orphan detection**: enabled helpers/asset packs that no enabled mod
  references, i.e. load time spent on nothing. The status bar keeps the
  count; clicking it opens a review — tick what you want gone, then
  disable it or move the zips to the OS trash.
- **Mods vs dependencies**: top-level mods (the things you play) are separated
  from the infrastructure, with per-mod overrides.
- **Favorites, structural tags** (helper / map-pack / collab / skin / audio /
  asset-pack, derived from zip contents), search, light/dark.

## Development

```sh
pnpm install
pnpm start        # electron-forge + vite dev
pnpm typecheck && pnpm lint && pnpm format:check
```

Point the app at a Celeste `Mods` folder from the onboarding screen or
Settings. Dev builds keep state in a separate `Celery-dev` config dir.

React Compiler is enabled; manual `useMemo`/`useCallback`/`memo` are banned by
lint. Pre-commit hooks (lefthook) enforce typecheck, lint, and formatting.

## Releases

Publishing a GitHub release builds signed (when secrets are configured) macOS
zips and an experimental portable Windows zip via `.github/workflows/release.yml`.
The macOS build auto-updates through update.electronjs.org; the Windows
portable build updates by downloading a new release.
