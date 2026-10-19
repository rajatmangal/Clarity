# Clarity navigation and frame review — 19 October 2026

The app frame now uses grouped navigation, a compact wordmark, a slim active-page marker, and a pinned vault/profile footer. The header shows the current location, currency, local/server status and the existing reload action. Page titles identify the actual screen. All eight existing themes use their own surface, text and accent colors.

On narrow screens the navigation opens as a full-height drawer. Navigation scrolls independently so Settings stays reachable in short windows. The drawer contains keyboard focus, makes the main content inert, closes with Escape or the backdrop, and returns focus to the menu button. Close and reload controls have 44px mobile targets. Temporary notifications are hidden while the drawer is open so they cannot cover its controls.

## Verification

- `npm test`: 147 passed, zero failures.
- `npm run desktop:prepare`: production build and isolated desktop runtime preparation passed.
- Chromium walkthrough: all navigation destinations, active-page semantics, all eight themes, a 1280×720 short window, and a 390×844 mobile viewport.
- Keyboard checks: initial drawer focus, Tab/Shift+Tab containment, Escape/focus return, destination/backdrop dismissal, and cleanup when resizing to desktop.
- Mobile Transactions: no horizontal page overflow.
- Charts render after their existing animations complete. No browser page exceptions during the walkthrough.

All browser checks use fictional data in `/tmp/clarity-frame-qa/vault`. No personal vault records were used or changed. Native Windows/macOS installer behavior was not retested for this presentation change.

## Screenshots

- [Light desktop](images/frame-light.png)
- [Graphite desktop](images/frame-graphite.png)
- [Short desktop window](images/frame-short-desktop.png)
- [Mobile drawer](images/frame-mobile-drawer.png)
- [Mobile Transactions](images/frame-mobile-transactions.png)
