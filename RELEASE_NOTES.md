# v1.0.5 stable release notes

This stable release contains runtime library 1.0.5 and editor library 1.0.3. Stable publication was authorized by the owner after the completed Milestone 7 validation gate.

## Included assets

- `h5p-find-and-correct-errors-library-1.0.5.h5p` — administrator library installer
- `synthetic.h5p` — synthetic example content with the libraries bundled
- `h5p-find-and-correct-errors-documentation-1.0.5.zip` — installation, authoring, compatibility, accessibility, security and limitation documentation
- `SHA256SUMS.txt` — SHA-256 checksums for all three downloadable payloads

## Verified

- Native installation, update preservation, authoring save/reopen/edit and learner completion on loopback WordPress 7.1.3 with H5P 1.17.9
- Official project-library installation plus synthetic native authoring and learner validation on an authorized WordPress 7.1.3 / H5P 1.17.9 multisite subsite
- Scoring, penalties, bounded retry, state v3 restoration and local xAPI statement construction
- Emitted `completed` xAPI event capture on the loopback real H5P host
- Synthetic and private-source legacy importer regressions, with only synthetic material distributed
- Node, Chromium, hosted axe, keyboard, responsive/zoom, deterministic package and privacy/security scans
- Native Sandbox 2 exports for two activities, structural validation, and local re-import of the French Unicode activity
- Imported learner 4/4 scoring plus genuine `answered` and `completed` H5P xAPI events
- Chromium touch emulation and a focused RTL stress check

## Not certified or verified

NVDA, VoiceOver, physical touch, Moodle, Lumi, H5P.com, Brightspace/LTI, real LRS receipt and gradebook transfer are not tested. This release makes no WCAG conformance, official H5P catalogue or universal-LMS claim. Managed hosts may prohibit custom-library installation. A coordinated administrator-confirmed backup remains mandatory before any university update.
