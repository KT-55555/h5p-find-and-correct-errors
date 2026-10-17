# Milestone 7 stable release gate

Date: 16 October 2026

Decision: **APPROVED FOR STABLE PUBLICATION.** The owner authorized the public push and stable v1.0.5 release on 16 October 2026; publication remains conditional on the final commit passing CI, privacy and checksum gates.

| Gate | Result | Evidence / qualification |
|---|---|---|
| Known P0/P1 implementation requirements | PASS | No product defect found across Node, Chromium, loopback and multisite validation |
| Native install, authoring and learner flow | PASS | Official H5P paths on two WordPress hosts |
| Hosted export and independent re-import | PASS | Two validated exports; ID 241 imported locally and passed 7/7 host criteria |
| Package structure and deterministic assets | PASS | Library and synthetic packages validate and reproduce current RC hashes |
| Local H5P xAPI sequence | PASS | Genuine answered/completed events match 4/4 |
| Remote LRS/gradebook receipt | NOT TESTED | No authorized endpoint; no claim made |
| Automated accessibility | PASS in scope | 17/17 browser; imported learner/editor axe zero violations; keyboard/reflow pass |
| Human assistive technology / physical touch | NOT TESTED | NVDA, VoiceOver and physical touch unavailable |
| Multisite update/rollback readiness | CONDITIONAL | Site scope and safe procedure documented; network administrator must confirm a coordinated backup before update |
| Public/private separation | PASS | Allow-list export and privacy/archive scan; private repository has no remote |
| Public CI and pre-release assets | PASS for current RC | CI run 38955573807 succeeded; published RC hashes reproduced |
| Other LMS portability | NOT TESTED | Moodle, Lumi, H5P.com and Brightspace/LTI remain outside the verified scope |
| Owner authorization for stable publication | PASS | Explicit approval received on 16 October 2026 |

## Version decision

No runtime/editor source defect was found. The stable candidate therefore remains runtime 1.0.5 and editor 1.0.3; changing the H5P library version solely for validation documentation would create an unnecessary update.

## Approval conditions

- Owner accepts the documented accessibility/platform limitations.
- A future public stable commit and assets repeat CI, privacy and checksum gates after an explicitly authorized push.
- A university deployment/update proceeds only after a network administrator confirms the coordinated backup and rollback plan.
- Any future LMS grade-reporting claim requires actual LRS/gradebook receipt evidence.

Stable publication may proceed only from the sanitized public repository after the final commit passes GitHub Actions and the uploaded assets reproduce the published checksums.
