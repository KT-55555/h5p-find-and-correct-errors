# Contributing

Use Node.js 20 or later and install the lockfile exactly with `npm ci`. Keep `node_modules/`, generated `dist/`, logs, local environments and host runtime state out of Git.

Before editing, check the active branch and working tree. Never add real course material, learner data, credentials, host backups, browser state or private fixtures to the public repository.

Run:

```powershell
npm.cmd run check
npm.cmd run test:browser
npm.cmd run test:host
powershell -ExecutionPolicy Bypass -File tools\package.ps1
npm.cmd run validate:packages
```

Runtime changes require tests in the independently testable `src/core` modules and, where DOM behavior differs, in `test/runtime-dom.test.mjs`. Import changes require inert-data security cases. Editor changes must preserve stable FCE2 target IDs and visual/markup round trips. Update the library patch versions whenever installed JavaScript or semantics changes.

Do not test experimental packages on a shared H5P host without an approved scope and tested rollback. The University of Waterloo multisite is outside the development test boundary.
