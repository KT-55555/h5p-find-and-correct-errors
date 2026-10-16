# Installation and upgrade

## Requirements

- H5P integration supporting Core API 1.28
- H5P.Question 1.5, H5P.JoubelUI 1.3 and FontAwesome 4.5
- Administrator permission to install libraries
- Node.js 20 or later only for development and packaging

## Packages

- `dist/h5p-find-and-correct-errors-library-1.0.5.h5p`: library-only installer containing runtime 1.0.5 and editor 1.0.3, with no content
- `dist/synthetic.h5p`: distributable synthetic example
- `dist/release-candidate-1.0.5/`: public-safe allow-listed bundle

The default package command produces distributable assets only. Internal regression fixtures are deliberately excluded from normal builds and from the public repository.

## Safe installation

1. Use a disposable host or verified staging clone. On Multisite, establish library/database/filesystem scope and coordinated rollback first.
2. Record installed project versions and dependent content.
3. Upload the library-only package from the H5P Libraries administration page. Never disable the file-extension check.
4. Verify runtime 1.0.5 and editor 1.0.3. The package references official dependencies and must not replace them.
5. Create a new synthetic item and test save/reopen/edit, learner completion, retry, responsive layout and state restoration.
6. Roll back database and H5P uploads together if required; do not delete shared libraries ad hoc.

The isolated local WordPress host passed this procedure. `tools/install-h5p-package.php` is a WP-CLI helper that calls the official H5P plugin validator/storage path; see `LOCAL_WORDPRESS.md`.

## Compatibility and upgrade behavior

- Runtime 1.0.3 uses `decimals: 1` rather than fractional semantics `step`, avoiding a divide-by-zero in H5P PHP while retaining half-point values.
- Runtime 1.0.3 and editor 1.0.2 decode the single HTML-entity layer applied by WordPress H5P filtering before parsing FCE2 JSON.
- Legacy compact markup remains accepted and is migrated to FCE2 on editor save.
- Runtime 1.0.4 maps legacy `showRemaining` and `revealOnExhaustion` values into the new three-state controls and migrates saved state versions 1/2 to state version 3.
- Runtime 1.0.5 increases selectable token hit areas to the WCAG 2.2 target-size minimum without changing content data.
- Existing content ID 1 survived the local upgrades; fresh content was created, reopened and edited through the real H5P editor.

## Rebuild and validation

```powershell
npm ci
npm.cmd run check
npm.cmd run test:browser
npm.cmd run package
npm.cmd run validate:packages
powershell -ExecutionPolicy Bypass -File tools\scan-public.ps1 -Root .
```

`package-lock.json` is the dependency source. `node_modules/` is ignored runtime state.
