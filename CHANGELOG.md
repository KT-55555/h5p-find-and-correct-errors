# Changelog

## Runtime 1.0.5 / editor 1.0.3 release candidate 3 — 2026-10-16

- Validated official installation, native authoring and learner operation on an authorized WordPress 7.1.3 / H5P 1.17.9 multisite subsite.
- Added live French Unicode, alternative-answer, hint, fractional-scoring, deferred-validation, bounded-retry, keyboard and 320-pixel reflow evidence.
- Extended the real-host test to capture and validate the emitted H5P `completed` xAPI event.
- Added Milestone 6 Sandbox, accessibility, compatibility and release-gate reports; retained explicit NVDA, VoiceOver, touch, Moodle, Lumi and remote-LRS limitations.

## Runtime 1.0.5 / editor 1.0.3 public release candidate — 2026-10-16

- Separated confidential legacy-import regression coverage from a fully synthetic public test suite.
- Made normal packaging public-only and ZIP output deterministic; private-source packaging now requires an explicit switch.
- Added least-privilege SHA-pinned GitHub Actions, Dependabot configuration and public tree/archive scanning.
- Added keyboard Tab/Shift+Tab/Space coverage, mobile target-size checks, forced-colours/reduced-motion emulation and 400% hosted reflow.
- Added Milestone 5 compatibility, accessibility, security/licence and publication privacy audits.

## Runtime 1.0.4 / editor 1.0.3 — 2026-10-16

- Added total/remaining/hidden error counts, bounded retry, successful-only auto-completion, optional hints, feedback timing and three-state solution disclosure with legacy-value migration.
- Added per-target points and penalty controls to the visual editor and strengthened maximum-score validation.
- Added optional straight/typographic apostrophe equivalence and broader Unicode/French answer tests.
- Added state version 3 with persisted retry count and stricter restored-state sanitization.
- Added recognized standalone Find-it HTML import, batch preview/write conversion and deterministic diagnostics with malformed/oversized/injection coverage.
- Added complete French semantics localization, bilingual author guidance, third-party notices and an allow-listed public RC bundle with SHA-256 checksums.
- Verified official host upgrade, existing-content preservation, fresh native authoring, five-target private regression, state/xAPI, axe and narrow/zoom reflow on the isolated local WordPress host.

## Runtime 1.0.3 / editor 1.0.2 — 2026-10-15

- Completed real WordPress 7.1.3 / H5P 1.17.9 authoring and learner integration testing.
- Replaced fractional semantics `step` values with `decimals: 1` to avoid an H5P PHP divide-by-zero while retaining half-point scoring.
- Added one-layer HTML-entity decoding for WordPress-filtered FCE2 JSON in both runtime and editor.
- Added regression tests for the exact WordPress-filtered payload shape and strengthened version/package validation.
- Added a WP-CLI helper that installs libraries through the official H5P plugin validation/storage path.
- Added a preserved loopback-only local WordPress/MariaDB development host and restart documentation.

## 1.0.1 editor accessibility update — 2026-10-15

- Added correct tablist/tab semantics to the visual/markup mode controls.
- Added accessible names to the visual contenteditable and markup textarea.
- Added rendered-Chromium learner/editor, mobile-reflow and axe regression coverage.

## 1.0.1 — 2026-10-15

- Added the `H5PEditor.FindAndCorrectErrors` visual/markup authoring widget with English and French strings.
- Added canonical FCE2 rich-text models, stable IDs, deterministic serialization, sanitization and legacy migration.
- Added attempt exhaustion, terminal-state handling, punctuation policy, post-correction display modes, richer xAPI definitions and completed events.
- Added jsdom learner/editor integration, axe-core, model/state/property, and archive validation tests.
- Bundled the editor dependency in library-only and sample packages.

## 0.1.0 — Unreleased

- Established native-library architecture and prior-art decision.
- Added canonical markup parser, Unicode tokenization and scoring foundations.
- Added safe paired JCloze/Find-it importer with the five-error regression fixture.
- Added initial H5P runtime, semantics, styles and English/French translations.
- Added automated validation and unit tests.

