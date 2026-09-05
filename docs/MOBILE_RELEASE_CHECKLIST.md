# Mobile Release Checklist

Use this list before creating the final store builds.

## App readiness

- [ ] `VITE_API_URL` points to a public `https://` API
- [ ] Demo or test data only is present in the release database
- [ ] App icons and splash screens are generated from the SOM PRO brand
- [ ] Android and iOS Capacitor projects are synced from the latest web build

## Android

- [ ] `android/key.properties` exists locally and is not committed
- [ ] Keystore path is correct
- [ ] `versionCode` is updated for the store submission
- [ ] `versionName` matches the release notes
- [ ] A signed `AAB` is generated from Android Studio or Gradle

## iOS

- [ ] Open the project in Xcode on macOS
- [ ] Set the signing team
- [ ] Confirm the bundle identifier
- [ ] Archive the app
- [ ] Upload through App Store Connect

## Store metadata

- [ ] Update `store/google-play.json`
- [ ] Update `store/app-store.json`
- [ ] Replace placeholder support and privacy URLs
- [ ] Confirm screenshots and store descriptions

## Final checks

- [ ] Run `npm run build`
- [ ] Run `npm run typecheck`
- [ ] Run `npm run mobile:release:check`
- [ ] Verify the app opens correctly on a device or emulator
