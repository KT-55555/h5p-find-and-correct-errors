# Milestone 6 accessibility report

Date: 16 October 2026

## Result

No serious or critical axe finding, keyboard blocker, focus trap, unlabeled correction field, status-announcement failure or horizontal-overflow defect was found in the tested environments. This is **not** a WCAG conformance certification.

| Surface | Method | Result |
|---|---|---|
| Loopback real H5P learner | axe-core 4.11.0 injected into the rendered H5P iframe | PASS: 0 serious/critical findings |
| Loopback real H5P editor | axe-core 4.11.0 on the native editor widget | PASS: 0 serious/critical findings |
| Chrome harness | axe, keyboard Tab/Shift+Tab/Enter/Space, focus, target size, reduced motion and forced colors | PASS, 15/15 suite overall |
| Sandbox 2 learner | Accessibility-tree inspection and keyboard activation in Chrome | PASS for tested interactions |
| Sandbox 2 320×800 | Real viewport override and scroll-width measurement | PASS: no horizontal overflow |
| 200%/400% loopback reflow | Chrome device metrics/page scale | PASS: no outer/iframe horizontal overflow |
| NVDA | Executable/process discovery | NOT TESTED: unavailable |
| VoiceOver | Platform availability | NOT TESTED: no macOS/iOS device |
| Physical touch/mobile screen reader | Device availability | NOT TESTED |

## Observed accessible behavior

- Neutral tokens are native buttons with names such as `Check word: était`.
- Correction controls receive focus and expose positional labels (`Correction for error 1 of 2`).
- Multiword targets produce a single correction field with the full phrase prefilled.
- Wrong selection, target discovery, hint, rejection and success text appears in an atomic polite status region.
- Hint, Finish, Show solution and Retry are keyboard-operable native buttons.
- The retry control disappears when the configured limit is reached.
- Visual/markup authoring controls use tab semantics in automated/editor inspection.

## Remaining manual script

1. On Windows with current NVDA and Chrome/Firefox, navigate from the task description through every token using Tab and Shift+Tab; confirm role/name, visible focus and reading order.
2. Activate wrong and correct tokens with Space and Enter; confirm each status update is spoken once and focus moves to the correction field.
3. Use a hint, submit an invalid correction, finish, show the solution and retry; confirm announcements do not expose answers prematurely.
4. Repeat at Windows High Contrast and 200%/400% zoom, checking that focus indicators and text remain visible.
5. On macOS/iOS, repeat with VoiceOver rotor/navigation and on a physical touch screen; verify explore-by-touch, zoom and on-screen-keyboard behavior.

These sessions must be recorded as actual screen-reader/device tests before any broad WCAG 2.2 AA conformance claim.
