# Mobile Publishing Checklist

This repo can ship to Android and iOS through Capacitor, but the app still needs a real HTTPS API before store submission.

## Required before release

1. Set `VITE_API_URL` to a public `https://` endpoint.
2. Keep test data only in demo or staging environments.
3. Build the web app first with `npm run build:frontend`.
4. Sync the web build into Capacitor with `npm run mobile:sync`.
5. Run the Android project from Android Studio for Play Store builds.
6. Run the iOS project from Xcode on macOS for App Store builds.

## Current scripts

- `npm run mobile:build:web`
- `npm run mobile:sync`
- `npm run mobile:add:android`
- `npm run mobile:add:ios`
- `npm run mobile:open:android`
- `npm run mobile:open:ios`
- `npm run mobile:doctor`

## Notes

- Android can usually be prepared on Windows.
- iOS final compilation and signing still require macOS and Xcode.
- The app is mobile-web-capable, but store release is a native wrapper flow, not a React Native or Flutter app.
