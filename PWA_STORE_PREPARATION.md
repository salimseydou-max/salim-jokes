# PWA Store Preparation Notes

This project is now structured for Android Trusted Web Activity (TWA) and iOS native-wrapper packaging.

## Android (Play Store / TWA)

- `manifest.json` includes:
  - name / short_name
  - standalone display mode
  - start URL and scope
  - 192px + 512px icons
  - maskable icon
  - theme and background colors
  - app shortcuts for deep-link launch targets
- Service worker (`sw.js`) provides offline-first capability and runtime caching.
- `.well-known/assetlinks.json` is included as a template and must be updated with:
  - final Android package name
  - release signing certificate SHA-256 fingerprint

## iOS (App Store wrapper via Capacitor or similar)

- iOS install metadata is present in `index.html`:
  - `apple-mobile-web-app-capable`
  - `apple-mobile-web-app-status-bar-style`
  - `apple-mobile-web-app-title`
  - `apple-touch-icon`
  - multiple iOS startup/splash images
- `.well-known/apple-app-site-association` template included for deep-linking prep.
- Safe-area aware CSS (`env(safe-area-inset-*)`) is enabled for notches and dynamic islands.

## What to replace before publishing

1. Placeholder identifiers in `.well-known/assetlinks.json`
2. Placeholder identifiers in `.well-known/apple-app-site-association`
3. Any package IDs and signing metadata used by your Android/iOS wrapper tooling
