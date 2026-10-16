# Security and licence audit

Date: 16 October 2026

## Outcome

**PASSED for release-candidate distribution.** No production npm dependency is present, `npm audit --omit=dev` reports zero known vulnerabilities, generated H5P archives contain only the two project libraries plus synthetic package metadata/content where applicable, and no credential or runtime-network feature is shipped.

## Import and content handling

- Legacy input is decoded with a 2 MiB limit and parsed as text; JavaScript is never evaluated.
- DTD/entity declarations, malformed pairs, ambiguous duplicates, invalid encoding and oversized input are rejected.
- Synthetic hostile HTML includes script and event-handler markup; regression tests confirm it is stripped and not executed.
- Runtime/editor rich text uses a small allow-list. Script, style, iframe, object, embed, SVG and MathML blocks are removed; arbitrary attributes and URLs are not retained.
- Restored state accepts only known target/ledger keys and compatible state versions; stale, malformed and tampered state is sanitized or ignored.
- Archive validation rejects duplicate or non-portable paths and unexpected bundled libraries. The public scanner rejects traversal paths and scans nested text entries for secret/path signatures.

## Supply chain

- Development dependencies are pinned by `package-lock.json` and installed with `npm ci --ignore-scripts` in CI.
- The lockfile records 40 development packages: 32 MIT, 2 ISC, 2 BSD-2-Clause, 1 BSD-3-Clause, 1 MIT-0, 1 Apache-2.0 and 1 MPL-2.0.
- `axe-core` and `jsdom` are test-only and are not bundled in H5P release assets.
- GitHub Actions uses `contents: read`, disables persisted checkout credentials and pins `actions/checkout` and `actions/setup-node` to full commit SHAs.

## Copyright and third-party code

The project implementation and importer are original code released under MIT. H5P.Question, H5P.JoubelUI and FontAwesome are referenced as host-provided dependencies and are not copied. Prior projects informed behavior only; no Mark the Words, Papi Jo or Hot Potatoes implementation code is bundled. Imported exercises retain their own copyright. See `LICENSE`, `THIRD_PARTY_NOTICES.md` and the private-source `PRIOR_ART.md` research record.

## Residual risks

No independent penetration test, code-signing process or external security review was performed. Host administrators must test custom-library installation on a disposable or recoverable environment and must not bypass H5P validation.
