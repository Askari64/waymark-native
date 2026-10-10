# Libraries

- Expo: native configuration/prebuild and local development, no EAS dependency.
- React Native + React: native controls and shared screen state.
- TypeScript: checks app and map types.
- expo-location: requested foreground GPS fixes and watching, no background permission.
- AsyncStorage: local saved places, not encrypted.
- MapLibre React Native: Android/iOS native vector map renderer, no Google billing key.
- MapLibre GL JS: web-preview map renderer only, never bundled into Android entrypoint.
- OpenFreeMap: free online map styles/tiles based on OpenStreetMap.
- FOSSGIS routed-foot: opt-in walking routes with rate limiting and explicit fallback.
- react-native-safe-area-context: avoids notches/system bars.
- expo-system-ui + expo-status-bar: system light/dark treatment.
- @expo/vector-icons: Ionicons for consistent controls.
- Playwright: browser-preview smoke/visual checks in development only.
