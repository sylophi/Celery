# Celery

Dependency-aware mod manager for [Celeste](https://www.celestegame.com/) /
[Everest](https://everestapi.github.io/). Instead of a flat list, Celery shows
your mods as a graph (collabs and maps on top, the helpers they pull in below),
and toggling a mod carries its dependency closure with it.

Celery reads and writes Everest's own files (`blacklist.txt`, `favorites.txt`,
the `everest.yaml` manifests inside each mod zip), so the in-game Toggle Mods
menu, Olympus, and Celery always agree. It keeps no parallel state about your
mods.

## Features

- **Dependency graph**: layered view of every installed mod; select one to
  light up what it needs and what needs it. Optional dependencies drawn dashed,
  on demand.
- **Cascading toggles**: enabling a map enables its helpers; disabling a helper
  takes its dependents down (or keeps shared ones a group member still needs).
  Cascades apply immediately; a setting turns on preview-before-write.
- **Groups**: store intent ("multiplayer", "skins"), not snapshots. Flipping a
  group computes the closure at apply time.
- **Orphan detection**: enabled helpers/asset packs that no enabled mod
  references, i.e. load time spent on nothing.
- **Mods vs dependencies**: top-level mods (the things you play) are separated
  from the infrastructure, with per-mod overrides.
- **Favorites, structural tags** (helper / map-pack / collab / skin / audio /
  asset-pack, derived from zip contents), search, light/dark, macOS vibrancy.

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
