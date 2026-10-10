Waymark for Android: save a spot with a name and note, find your way back with distance and walking estimates, and open the destination in Google Maps. On-device saved spots, foreground-only location, opt-in online walking routes, light and dark themes. No direction arrow.

Download `waymark-1.0.0-debug.apk`. This is a standalone debug-key-signed test build, not a Play Store release or production-signed app. Allow installation from this download source in Android settings. Map tiles and routes need internet. GPS and route estimates can be wrong.

The repository and release are private. A GitHub account with access is required. See README and SECURITY.md for provider privacy details and upstream build-tool advisories.


Build provenance: APK built from commit `2c06253cc72a4ab3ab42536fd28a719ab0fad141` in run #7. App source is unchanged in this tag; later commits only fix CI and documentation. The exact APK checksum was verified and its Android smoke test passed in run #8 (5m 7s, no rebuild): https://github.com/Askari64/waymark-native/actions/runs/38039372909 . The test covered location, saving, guide controls, persistence after force-stop/relaunch and no fatal crashes. Online route opt-in was not exercised by that native test.
