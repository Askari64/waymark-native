# Dependency audit

Audit recorded October 10, 2026. Current Expo 57 / React Native 0.86 dependency tree reports 16 high and 8 moderate package findings. These counts include propagation through parent packages, not distinct vulnerabilities. Root advisories are braces stack-exhaustion from deeply nested patterns, node-forge RSA signature verification, and uuid buffer bounds checks. These paths are primarily Node build/configuration tooling. The APK is not a Node server, but untrusted inputs to build tooling remain a concern. Do not run npm audit fix --force: its proposed Expo/RN downgrades break the supported toolchain. No patched braces version is published at this audit date.

Run npm audit --json to inspect current results. Build only trusted source on GitHub-hosted isolated runners; the workflow uses no persistent external credentials. Review upstream updates before a public production release.

https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
