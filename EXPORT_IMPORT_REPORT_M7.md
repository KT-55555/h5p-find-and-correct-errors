# Milestone 7 export/import report

Date: 16 October 2026

## Result

The native H5P exports for both authorized Sandbox 2 activities were captured, structurally validated and hashed. The French Unicode activity was then imported into the isolated loopback WordPress host and passed learner/editor validation.

| Source | HTTP | Bytes | Entries | Runtime/editor | Targets / accepted answers | SHA-256 |
|---|---:|---:|---:|---|---:|---|
| ID 240 baseline | 200 | 825,039 | 90 | 1.0.5 / 1.0.3 | 2 / 2 | `424252d7d04c5ffde76d697e70af5a850dc5ec77809d6263c418e4eeba5dfd3e` |
| ID 241 French Unicode | 200 | 825,132 | 90 | 1.0.5 / 1.0.3 | 2 / 3 | `26c19903e20d459599bc5a3a669e0d41799ad7e76a48833327b31a6b30fdbd71` |

The command-line response did not expose a Content-Type header. The browser rendered the response as the expected ZIP/H5P binary, and archive validation confirmed safe portable paths, no duplicate entries, valid manifests/content, declared versions, FCE2 data, source ranges and accepted answers.

## Local re-import result

ID 241's export was imported through the official H5P Add New/Upload interface as local content ID 4. It preserved:

- French Unicode and punctuation;
- targets `était` and `ont terminé`;
- accepted answers `étaient`, `a terminé` and `a fini`;
- both hints and rich-text explanations;
- deferred validation and learner-response display;
- two editor markers and compact-markup round trip.

The learner completed with 4/4. State v3 recorded both targets as found and corrected. Genuine H5P `answered` and `completed` events reported the same 4/4 score and completion/success. Learner and editor axe scans found zero violations. The only console item was a known Chromium/H5P `allowfullscreen` warning, not a project error.

## Installer/package distinction

The library installer contains the runtime/editor library folders only; it intentionally has no `h5p.json` or `content/content.json`. A content package contains those two files plus its required libraries. Structural ZIP validation does not prove a host will accept or execute a package; this milestone separately verified official host import, editor reopen and learner execution.

Export files and location-specific URLs remain ignored evidence and are not public release assets.
