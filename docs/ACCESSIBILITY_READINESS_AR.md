# Accessibility Readiness

## Status

- Accessibility core pass: complete within the current scope.
- Browser matrix and full screen-reader verification: still recommended as final manual validation.

## What is already in place

- RTL support for Arabic and Hebrew.
- Skip link and landmark-based navigation.
- Automatic focus handoff on important page transitions.
- Keyboard-friendly navigation for the main app shell.
- Clearer error and empty states in the reviewed release path.

## What remains to verify manually

- Chrome, Edge, Firefox, and Safari-like browser behavior.
- Screen-reader announcements in the main school flows.
- No text overlap or clipped labels on smaller viewports.
- Focus visibility in all major pages after content updates.

## Operational note

- Accessibility should be reviewed whenever a new major screen or modal is added.
- Any new interactive element must preserve keyboard navigation and clear labeling.
