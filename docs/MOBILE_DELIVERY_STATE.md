# Mobile delivery state

This note separates the mobile work into three buckets so we can keep the repository clean and know exactly what still needs a Mac later.

## 1) Final and should stay in the repository

These are part of the deliverable and should be committed:

- `android/` source tree
- `ios/` source tree
- `.gitignore`
- `capacitor.config.ts`
- `assets/icon-background.png`
- `assets/icon-foreground.png`
- `assets/icon-only.png`
- `assets/splash.png`
- `assets/splash-dark.png`
- `package.json`
- `package-lock.json`
- `apps/frontend/package.json`
- `apps/frontend/src/api/http.ts`
- `apps/frontend/.env.mobile.example`
- `scripts/capture-store-screenshots.js`
- `scripts/runtime/capacitor-userinfo-shim.cjs`
- `scripts/runtime/generate-mobile-assets.ps1`
- `scripts/runtime/mobile-release-check.js`
- `docs/MOBILE_PUBLISHING.md`
- `docs/MOBILE_RELEASE_CHECKLIST.md`
- `docs/MOBILE_SIGNING.md`
- `store/README.md`
- `store/app-store.json`
- `store/google-play.json`
- `store/final-screenshots/`
- `store/publishing/`
- `store/screenshots/`

These files describe the mobile packaging, store copy, screenshots, signing notes, and the Capacitor Android/iOS project itself.

## 2) Temporary and local-only

These should stay out of the final commit and should be ignored locally:

- `.android-home/`
- `.gradle-user/`
- `.gradle-user-fresh/`
- `tools/`
- `tools/jdk21/`
- `tools/jdk21/jdk-21.0.12.1+1/`
- `android/.gradle/`
- `android/build/`
- `android/app/build/`
- `ios/Pods/`
- `ios/build/`
- `ios/.symlinks/`

These folders are safe to recreate locally when we need Android build tooling, caches, or downloaded JDK files.

## 3) Needs macOS / Xcode later

These parts are final in source form, but the last signing/export step must happen on macOS with Xcode:

- iOS archive generation
- IPA export
- Apple signing and provisioning profile selection
- App Store Connect upload

The iOS source is already in the repository, so nothing is blocked in code. What remains is the platform-specific export step.

## Practical summary

- Keep: source, assets, Capacitor config, store copy, and documentation.
- Ignore: local JDK downloads, Gradle caches, and Android/iOS build outputs.
- Finish later on macOS: the signed iOS archive and IPA.
