# Mobile Signing Notes

## Android

1. Copy `android/key.properties.example` to `android/key.properties`.
2. Fill in your keystore path and passwords.
3. Put the keystore file in a safe local location that is not committed.
4. Build a release bundle from Android Studio or Gradle once the file is in place.

## iOS

1. Open the project in Xcode on macOS.
2. Set the signing team and bundle identifier in the app target.
3. Use an Apple Developer account for App Store signing.
4. Archive from Xcode and upload to App Store Connect.

## Notes

- The repo now has a release-signing hook for Android if `android/key.properties` exists.
- iOS signing cannot be completed on Windows because Xcode is required.
