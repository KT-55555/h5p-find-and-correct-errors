# Known limitations

- NVDA and VoiceOver testing has not been run; no WCAG conformance claim is made.
- Moodle, Lumi, H5P.com and Brightspace/LTI behavior has not been tested; neither Docker nor Lumi was available on the Milestone 6 machine.
- Physical touch and mobile screen-reader behavior remain untested. Automated 390x844, 320px/200%-zoom and 320px/400%-zoom reflow pass; forced-colours and reduced-motion media behavior are automated checks, not human visual verification.
- External LRS/gradebook transmission is not established. A real H5P `completed` event is captured locally, but that is not remote receipt or gradebook transfer.
- Sandbox 2 native exports and a local re-import are verified. The command-line export response did not expose a Content-Type header, so archive structure and actual host import—not that header—were used as evidence.
- Sandbox 2 content-state persistence and result logging were disabled by existing site settings, so reload/logout/session resume was unavailable and those settings were deliberately left unchanged.
- Text-changing markup edits cannot preserve arbitrary inline formatting; the editor warns before flattening formatting and retains target metadata by order.
- The offline importer supports recognized Hot Potatoes 6 JCloze / Find-it structures, not arbitrary legacy HTML. Ambiguous inputs require manual mapping correction.
- Packages are not cryptographically signed. Verify the published SHA-256 checksums.
- The custom content type is not listed or endorsed in the official H5P catalogue.
- A network-active backup plugin was visible, but backup date, location, retention, downloadability and restore validity were not available to the site administrator. A coordinated administrator-confirmed backup is required before a university update.

Real WordPress update preservation, create/save/reopen/edit, five-target private regression, learner runtime, scoring, retry limit, xAPI construction, responsive layout and logged-in state persistence are verified on the local host described in `LOCAL_WORDPRESS.md`.

