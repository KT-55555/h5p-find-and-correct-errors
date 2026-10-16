# Compatibility matrix

Results are limited to the named versions and methods.

| Platform or surface | Version | Result | Method and caveat |
|---|---:|---|---|
| Node unit/DOM/import | Node 24.18.0 | PASSED | 39 private-source tests; the public export excludes two private-only regression tests and passes its synthetic suite. |
| Chrome browser harness | Chrome 155.0.8059.40 | PASSED | Rendered learner/editor interaction, keyboard, axe, 390x844 reflow, target size and media-feature emulation. |
| Local WordPress + H5P | WordPress 7.1.3; H5P 1.17.9; PHP 8.4.23; MariaDB 11.4.13 | PASSED | Official H5P validation/storage install, native author save/reopen/edit, learner flow, state and local xAPI statement checks. |
| Local WordPress zoom | Chrome 155 | PASSED | No outer or iframe horizontal overflow at 320 CSS px with 200% and 400% page scale. |
| Authorized WordPress Multisite sandbox | WordPress 7.1.3; H5P 1.17.9; PHP 8.1.2; MySQL 8.0.46 | PASSED | Official project-library install, two synthetic activities, native authoring, learner completion, keyboard/retry and 320px reflow. Export file capture remained incomplete and content-state persistence was disabled. |
| Moodle | Unknown | NOT TESTED | Custom library installation requires an authorized administrator and compatible H5P integration. |
| Lumi | Unknown | NOT TESTED | No authorized disposable installation was available. |
| H5P.com | Managed service | NOT TESTED | Custom content types may require provider approval or may be unavailable. |
| Brightspace/LEARN or other LTI host | Unknown | NOT TESTED | No claim of LTI, gradebook or remote LRS receipt. |
| NVDA + Windows browser | Unknown | NOT TESTED | NVDA was not installed/discoverable on the test machine. |
| VoiceOver + Safari | Unknown | NOT TESTED | No authorized macOS device was available. |

The library declares H5P Core API 1.28 and depends on H5P.Question 1.5, H5P.JoubelUI 1.3 and FontAwesome 4.5. Those shared dependencies are referenced, not bundled.
