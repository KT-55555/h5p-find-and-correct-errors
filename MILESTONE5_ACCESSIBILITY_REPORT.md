# Milestone 5 accessibility report

Date: 16 October 2026

Target: WCAG 2.2 Level AA. This is a test objective, not a conformance certification.

## Results

- PASSED — all 15 Chrome 155 rendered-harness checks and all 7 loopback WordPress/H5P checks passed; learner/editor axe scans found no serious or critical issue in the tested project scopes.
- PASSED — native-button Enter and Space activation, Tab/Shift+Tab movement, full-expression focus transfer, labeled correction input and visible focus behavior in real Chromium.
- PASSED — live status, `aria-invalid`/description relationships, text feedback and non-colour terminal states in DOM and browser regressions.
- PASSED — no horizontal overflow at 390x844, or at 320 CSS px with 200% and 400% page scale on the hosted item.
- PASSED — learner token targets meet the automated 24 CSS-pixel minimum in the 390x844 run.
- PASSED WITH LIMITATION — forced-colours and reduced-motion media queries are exercised through Chromium emulation. This is not a human high-contrast visual review.
- NOT TESTED — NVDA was not installed or discoverable on `KOSTIK`; no NVDA claim is made.
- NOT TESTED — VoiceOver/Safari; no authorized macOS environment was available.
- NOT TESTED — physical touch and mobile screen-reader behavior.

## Manual assistive-technology script

1. Open a fresh synthetic item with the content language and UI language recorded separately.
2. Read from the instructions and verify undiscovered error locations are not announced.
3. Tab and Shift+Tab through tokens and controls; verify order, visible focus and no trap.
4. Activate a multiword target with Enter and Space; verify one input for the full expression receives focus and has a useful label.
5. Submit an incorrect correction; verify the error and hint are announced once and focus remains understandable.
6. Complete, Finish, Show solution and Retry; verify score, state and button availability are understandable without colour.
7. Reload a partial attempt and confirm restored answers are announced coherently.
8. Repeat at 200% and 400% zoom and with the platform mobile screen reader.

Automated results do not establish full WCAG 2.2 AA conformance.
