# H5P Find and Correct Errors

`H5P.FindAndCorrectErrors` is an H5P question type for exercises where learners first locate an error in ordinary-looking text and then type its correction inline.

## Status

Milestone 5 public release candidate: runtime 1.0.5 and editor 1.0.3. The native WordPress/H5P workflow, scoring/state/xAPI construction, deterministic packages, hostile-input handling, browser accessibility checks and clean public export pass. Human screen-reader, physical-touch and non-WordPress host tests remain explicitly unverified, so this is an RC rather than a WCAG or cross-platform certification.

## Authoring markup

```text
The students [was|were] ready.
She [did not went|did not go||didn't go] yesterday.
```

Use `||` for alternative answers and a backslash before a literal `[`, `]`, `|`, or backslash. A marked span may contain several words; every word in that span opens the same correction field.

The real H5P editor provides Visual and Markup modes. Visual selection creates annotations, while the FCE2 model preserves stable target IDs, formatting and metadata. Text-changing markup edits that would flatten formatting require explicit confirmation.

## Development

Requirements: Node.js 20 or later. Dependencies are pinned in `package-lock.json`; `node_modules/` is ignored.

```powershell
npm ci
npm.cmd run check
npm.cmd run test:browser
npm.cmd run package
npm.cmd run validate:packages
powershell -ExecutionPolicy Bypass -File tools\scan-public.ps1 -Root .
```

Generated packages are written to ignored `dist/`. The administrator installer is `dist/h5p-find-and-correct-errors-library-1.0.5.h5p`. The distributable synthetic example and checksums are in `dist/release-candidate-1.0.5/`. Internal fixtures are never built by the release script.

## Importing legacy Find-it exercises

```powershell
node tools/import-hotpot.mjs "legacy\exercise.jcl" "legacy\exercise.htm" output.json
```

For a previewable batch conversion:

```powershell
npm.cmd run import:batch -- --input legacy-folder --output converted --preview
npm.cmd run import:batch -- --input legacy-folder --output converted --write
```

The importer supports paired Hot Potatoes 6 JCloze / Find-it 3.2b sources and recognized standalone generated HTML, cross-checks answer order, emits diagnostics and treats every source as inert data. Review the editable JSON before using it in H5P.

## Safety and license

Original project code is MIT licensed. Do not upload experimental libraries to a shared site without rollback and scope approval. Keep real course material, learner data, credentials and host backups out of source and release archives. See `AUTHOR_GUIDE.md`, `GUIDE_FR.md`, `SECURITY_AND_LICENSE_AUDIT.md`, `THIRD_PARTY_NOTICES.md` and `RELEASE_CHECKLIST.md`.

