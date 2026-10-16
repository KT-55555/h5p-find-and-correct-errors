# Milestone 6 compatibility report

Date: 16 October 2026

| Platform | Exact tested version | Result | Scope |
|---|---|---|---|
| Sandbox 2 WordPress Multisite | WordPress 7.1.3; H5P 1.17.9; PHP 8.1.2-1ubuntu2.26; Apache 2.4.52; MySQL 8.0.46; Chrome 155.0.8059.40 | PASS with noted export/persistence limits | Official custom-library install, authoring, learner, keyboard, retry and narrow viewport |
| Loopback WordPress | WordPress 7.1.3; H5P 1.17.9; PHP 8.4.23; MariaDB 11.4.13; Chrome 155 | PASS | Install/update, native editor, learner, state v3, emitted xAPI event, axe and zoom |
| Node/browser harness | Node 24.18.0; axe-core 4.11.0; jsdom 26.1.0; Chrome 155 | PASS | Unit, DOM, import/security, editor/learner and responsive regressions |
| Moodle | No Docker/VM/plugin installation available | NOT TESTED | No institutional Moodle was accessed |
| Lumi | No Lumi executable/installation available | NOT TESTED | Installing an unrelated desktop stack was not proportionate or required |
| H5P.com | No authorized account | NOT TESTED | Managed-service custom-library policy may block installation |
| Brightspace/LEARN/LTI | No authorized disposable integration | NOT TESTED | No LMS receipt or gradebook claim |
| External LRS | No authorized endpoint | NOT TESTED | Local event capture is not remote receipt |

The library declares H5P Core API 1.28 and references host-provided H5P.Question 1.5, H5P.JoubelUI 1.3 and FontAwesome 4.5. The Sandbox 2 patch releases 1.5.53, 1.3.45 and 4.5.4 were compatible and were not replaced.

## Portability observations

- A public synthetic package imported successfully into Sandbox 2 and created ID 240.
- Native ID 241 survived save/reopen/update and visual/markup round-trip without Unicode or metadata loss.
- The live Reuse dialog exposed Download and Copy controls. Automated download capture timed out, so exported-file reimport on Sandbox 2 is not claimed.
- Package validation independently checks archive paths, required JSON, declared dependencies, the public allow-list and checksums.
- Managed hosts that prohibit custom libraries remain unsupported deployment targets unless their administrator approves this content type.
