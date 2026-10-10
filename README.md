# waymark.

Leave a mark. Find your way.

A native Android spot saver built with Expo, React Native and TypeScript. Saved places have a name and note. Guide mode shows distance, a walking estimate, an online map, and a Google Maps handoff. The direction arrow is intentionally absent.

## Run

Node 22, npm, Java 17 and Android SDK are needed for Android development.

```sh
npm ci
npm run typecheck
npm test
npx expo prebuild --platform android
npx expo run:android
```

MapLibre is a native module, so this app does **not** run in Expo Go. No EAS account, Google Maps key, or paid service is required. `npm run web` provides a browser preview of the shared React Native UI, with a MapLibre GL JS map adapter. Add `?preview` to the local preview URL for clearly simulated demo data; this mode is web-only and never enabled in the APK.

## APK automation

`.github/workflows/android.yml` checks TypeScript/tests, generates Android native code, builds a **standalone debug-key-signed APK with its JS bundled**, uploads a workflow artifact, and attaches it plus SHA-256 checksum to releases on `v*` tags. Main-branch pushes produce an artifact without a release. Tags such as `v1.0.0` produce a private GitHub release. Debug builds are for personal testing, not store distribution. This uses Expo’s standard test signing key, not a private production signing identity. A future production-signed build may need uninstall/reinstall, which removes saved spots. Do not uninstall if you need those spots. Production signing needs a separate, owner-controlled key setup.

## Privacy and limitations

No account, analytics, ads, or app backend. Names, notes and coordinates are kept in AsyncStorage on this device, not encrypted. Android backup is disabled. Deleting the app deletes its spots. Location permission is requested only when you tap to use location, and foreground watching stops in the background.

Online map tiles come from OpenFreeMap and can reveal the viewed area and your IP. Online walking routing is opt-in in guide mode. FOSSGIS receives current/destination coordinates and logs route requests; notes and the full list are never sent. Routing is limited to once every 30 seconds after movement. Google Maps receives the destination when you open it. Distance without routing is explicitly straight-line, not a navigable path. Route failures fall back to that estimate. No indoor/floor navigation or safety guarantee. Public map/routing services have no service-level guarantee.

Attribution: © OpenStreetMap contributors, OpenFreeMap. FOSSGIS walking routing: https://routing.openstreetmap.de/about.html . Map setup: https://openfreemap.org/quick_start/ .

## Code map

- `App.tsx`: screens, foreground location, storage, consent, errors and navigation.
- `src/lib/geo.ts`: pure distance/formatting/storage-validation helpers.
- `src/components/SpotMap.tsx`: native MapLibre renderer.
- `src/components/SpotMap.web.tsx`: browser-only map adapter.
- `plugins/withBackupDisabled.js`: prevents Android backup of saved spots.
- `tests/geo.test.ts`: location math, labels, link and corrupted-storage tests.
- `LIBRARIES.md`: what each library is for.
- `SECURITY.md`: known upstream dependency audit findings.

## Build once, reuse artifacts

Main pushes run one Gradle `assembleRelease` command, then a separate clean emulator job tests that APK. Tags do not rebuild. A manual workflow dispatch can set `reuse_run_id` to test an existing `waymark-debug-apk` artifact without another build. Release assets come from the tested build; release notes name its SHA and validation run.
