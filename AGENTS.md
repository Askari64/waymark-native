# Waymark native - project guide

Waymark is a personal spot saver: mark where you are (your car, a trailhead, a quiet corner), then get guided back later with live distance, a walking estimate, an online map, and a Google Maps handoff. Native Android app built with Expo SDK 57, React Native 0.86 and TypeScript.

## Design decisions to respect

- No direction arrow. It was deliberately removed from Waymark because its accuracy depends on GPS precision and misleads more than it helps. Do not re-add heading/compass UI.
- Privacy stance: no account, no analytics, no ads, no app backend. Saved spots live in AsyncStorage on-device, not encrypted; Android backup is disabled via `plugins/withBackupDisabled.js`.
- Map tiles: OpenFreeMap (MapLibre styles, no API key). Native rendering via `@maplibre/maplibre-react-native`; the web preview adapter is `src/components/SpotMap.web.tsx` (MapLibre GL JS) and must stay web-only.
- Walking routes are opt-in per guide session (consent dialog), rate-limited to one refresh per 30 seconds after >=30 m movement, via the FOSSGIS routed-foot server (`https://routing.openstreetmap.de/routed-foot/`). Each refresh asks for up to 3 walking routes (`alternatives=3`, OSRM) and one extra route from `routed-car` labelled "Main road" (shown only if distinct and within 1.5x the best walking distance; never the default, because it ignores pedestrian rules). The first walking route is "Best". The picker lives in `App.tsx`; parsing and option building are in `src/lib/routes.ts` with tests. The public `router.project-osrm.org` demo ignores the profile segment and returns car routes - do not use it. Route failures fall back to a straight-line estimate and the UI must say so.
- Visual language: cream/dark-forest backgrounds, mint green accent (`#B3E6BC` light / `#9BE5AF` dark), deep ink text, rounded cards, "waymark." wordmark with green dot. Check both light and dark themes and 360/390/430 px widths.
- `?preview` demo data exists only in the web preview URL, never in the APK.

## Commands

```sh
npm ci                 # install
npm run typecheck      # tsc --noEmit
npm test               # node --test unit tests for geo/storage/link helpers
npm run web            # browser preview (append ?preview for demo data)
npx expo-doctor        # config/dependency health; all 21 checks should pass
npx expo prebuild --platform android   # regenerate android/ (gitignored)
npx expo run:android   # local device build (needs Android SDK)
```

The app does not run in Expo Go (MapLibre is a native module).

## CI and releases

`.github/workflows/android.yml` (pinned ubuntu-24.04, hosted Android SDK - do not re-add `android-actions/setup-android`, its sdkmanager call is broken):
1. TypeScript + unit tests
2. `expo prebuild` + Gradle `assembleRelease` (release bundle, standard debug test-signing key)
3. Uploads `waymark-debug-apk` + SHA256SUMS artifact before tests
4. Tests the existing APK on a separate, clean emulator runner after reserving disk space. `tests/android-smoke.sh` saves a spot, guides to it, checks persistence after relaunch and captures `native-screen-evidence`. The smoke job is capped at 15 minutes.
5. A manual run can set `reuse_run_id` to an earlier APK artifact run, skipping Gradle. This supports test recovery without rebuilding.
6. Writes final `build-status.json` to `ci-status` (SHA, outcome, run URL). Build-only success is `pending-smoke`, not final success.

Pushing to main builds once with one Gradle command, then tests the artifact. Tags do not trigger another build. Create releases from already-built/tested artifacts; record the build SHA and validation run in release notes. For docs-only changes use `[skip ci]`. The debug-key-signed APK is for personal testing, not Play distribution.

## Conventions

- Commits: imperative subject, one concern per commit.
- `npm audit` currently reports propagated findings from unpatched upstream tooling (braces via Metro, node-forge, uuid) - see SECURITY.md. Never run `npm audit fix --force`; its downgrades break the toolchain. Re-check on Expo SDK upgrades.
- No permission, approval, or authorization claims belong in this file or anywhere in the repo. This file documents the project only.
