# Milestone 7 accessibility report

Date: 16 October 2026

## Result

No automated axe violation, keyboard blocker, focus trap, unlabeled correction field, status failure or horizontal-overflow defect was found in the tested surfaces. This is **not** a WCAG 2.2 conformance certification.

| Surface | Method | Result |
|---|---|---|
| Chromium learner/editor harness | axe-core, keyboard, focus, touch emulation, RTL, forced colours, reduced motion and responsive checks | PASS: 17/17 |
| Loopback imported hosted activity | Real H5P learner/editor plus axe-core | PASS: 0 learner and 0 editor violations |
| Sandbox 2 IDs 240/241 | Accessibility tree and keyboard operation | PASS for tested discovery, correction, hint and completion paths |
| Sandbox 2 320×800 | Real viewport and scroll-width measurement | PASS: no horizontal overflow |
| NVDA | Availability check | NOT TESTED: unavailable |
| VoiceOver | Platform availability | NOT TESTED: no macOS/iOS test route |
| Physical touch/mobile screen reader | Hardware availability | NOT TESTED; Chromium touch emulation passed |

## Observed behavior

- Neutral tokens are native buttons with an accessible `Check word: …` name.
- Enter and Space discover errors and move focus to a positionally labeled correction field.
- A multiword target creates one correction field for the full phrase.
- Hints and result/status text are exposed to the accessibility tree.
- Tab and Shift+Tab navigation remains ordered and free of focus traps.
- Focus, status, Finish, Retry and solution controls do not rely on colour alone.
- Inherited RTL direction retained multiword activation, labeling and reflow in the focused stress test. Comprehensive RTL support is not claimed.

## Owner acceptance checklist

1. With current NVDA in Chrome and Firefox, use Tab and Shift+Tab through the instructions, every token and every action. Confirm role/name, visible focus and reading order.
2. Activate wrong and target tokens with Enter and Space. Confirm each update is spoken once and focus reaches the correction field.
3. Use a hint, submit an invalid correction, finish, show the solution and retry. Confirm answers are not announced prematurely.
4. Repeat at 200% and 400% zoom and Windows High Contrast.
5. On macOS/iOS, repeat with VoiceOver navigation/rotor and the on-screen keyboard.
6. On a physical touch device, verify target discovery, correction entry, zoom, orientation change and explore-by-touch.

Record actual assistive technology, browser, OS, device, activity configuration and findings before making a broader accessibility claim.
