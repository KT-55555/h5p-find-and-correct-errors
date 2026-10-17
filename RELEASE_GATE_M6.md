# Milestone 6 release gate

Date: 16 October 2026

Decision: **`v1.0.5-rc.3` was published as a pre-release; do not publish a stable release yet.**

| Gate | Result | Evidence / qualification |
|---|---|---|
| All known P0/P1 implementation requirements | PASS | Node, browser, loopback and Sandbox 2 evidence; no severe product defect found |
| Real H5P install and native author/learner flow | PASS | Loopback and Sandbox 2, official H5P paths |
| Sandbox multisite safety | CONDITIONAL PASS | Site 23 prefix/uploads and official implementation support scoped writes; no practical restore ID exposed |
| Package structure and deterministic checksums | PASS locally | `npm run package` and `npm run validate:packages` |
| Real xAPI event | PASS locally | Loopback H5P `xAPI` listener observes `completed` and validates score/completion |
| LMS/LRS receipt or gradebook | NOT TESTED | No authorized disposable integration |
| Automated accessibility | PASS in scope | Real-host editor/learner axe has no serious/critical findings; keyboard/reflow checks pass |
| Human assistive technology | NOT TESTED | NVDA/VoiceOver/touch unavailable |
| Moodle/Lumi portability | NOT TESTED | No disposable installations available |
| Sanitized public tree/archive scan | PASS locally | Allow-list exporter plus nested archive/path/secret canaries |
| Public reachable-history scan | PASS | Every reachable blob in the separate public repository was scanned before push; no private canary, internal host/path or token pattern matched |
| Hosted CI and release artifact download | PASS | CI run 38955573807 succeeded; all three downloaded `v1.0.5-rc.3` assets matched `SHA256SUMS.txt` |
| Stable-release approval | NOT GRANTED | Specification explicitly reserves stable publication for owner approval |

## Version decision

No runtime/editor source defect required a semantic H5P version bump. Candidate `v1.0.5-rc.3` therefore contains runtime 1.0.5 and editor 1.0.3. Its new tag targets sanitized public commit `351bae19a7a990c20931d7ccb100916a73deee9b`; `v1.0.5-rc.2` was not changed.

## Blocking evidence before stable

- Owner review and explicit approval of the final stable publication.
- At minimum, disposition of the untested NVDA/VoiceOver/touch and Moodle/Lumi risks; they may remain documented limitations if the owner accepts them, but must not be represented as passes.
- The published RC's GitHub Actions and downloaded checksum gates pass. Repeat those gates for any future stable commit/assets.
- A real LRS/gradebook test is required only for any future LMS-grade reporting claim.

## Installation and rollback

Install with the official H5P library upload path using `dist/h5p-find-and-correct-errors-library-1.0.5.h5p`. Do not enable extension-check bypass and do not update H5P.Question/JoubelUI/FontAwesome as part of this release. On a multisite, confirm the active site prefix/upload directory and coordinated backup first. Roll back a site install with a coordinated database/files backup; do not delete libraries that have dependent content.
