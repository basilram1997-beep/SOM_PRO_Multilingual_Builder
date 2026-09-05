# Store Metadata

This folder keeps store-facing text and release metadata separate from app code.

## Files

- `google-play.json`: Google Play listing template
- `app-store.json`: App Store listing template
- `publishing/`: ready-to-use store copy, privacy draft, and screenshot checklist

## What to replace

- Support email
- Website URL
- Privacy policy URL
- Final localized store copy if you want different Arabic and English listings

## Current assets already in the repo

- App icon and splash assets live in `assets/`
- Brand assets live in `assets/brand/`
- Web/owner portal branding lives in `web-page/index.html`
- Store-facing policy and release references live in `docs/`

## Ready-to-publish pack

The `store/publishing/` folder is the operator-facing handoff pack for:

- Google Play listing text
- App Store listing text
- Privacy policy draft
- Screenshot checklist
- Final release notes reminder

Use those files when preparing the store submission, then only replace the real support email, website, and privacy URLs.

## Why this helps

- Keeps publishing text in one place
- Makes store review updates easier
- Reduces the risk of editing code just to change store copy
