# Milestone 7 compatibility report

Date: 16 October 2026

| Platform | Exact tested version | Result | Scope |
|---|---|---|---|
| WordPress Multisite | WordPress 7.1.3; H5P 1.17.9; PHP 8.1.2; Apache 2.4.52; MySQL 8.0.46; Chrome 155 | PASS in declared scope | Site-scoped author/learner, keyboard, reflow, native export |
| Loopback WordPress | WordPress 7.1.3; H5P 1.17.9; PHP 8.4.23; MariaDB 11.4.13; Chrome 155 | PASS | Preserved content plus hosted-export import, editor, learner, xAPI and axe |
| Node/browser harness | Node 24.18.0; axe-core 4.11.0; jsdom 26.1.0; Chrome 155 | PASS | Unit/DOM/import/security, keyboard, responsive, touch emulation and RTL stress |
| Moodle | No authorized disposable installation | NOT TESTED | No compatibility claim |
| Lumi | No executable/installation available | NOT TESTED | No compatibility claim |
| H5P.com | No authorized account | NOT TESTED | Managed-service policy may prevent custom libraries |
| Brightspace/LEARN/LTI | No authorized disposable integration | NOT TESTED | No compatibility or gradebook claim |
| External LRS | No authorized endpoint | NOT TESTED | Local xAPI event capture is not remote receipt |

The runtime declares H5P Core API 1.28 and host-provided H5P.Question 1.5, H5P.JoubelUI 1.3 and FontAwesome 4.5. The tested multisite supplied H5P.Question 1.5.53. Shared host libraries were not replaced.

Both native multisite exports passed archive validation. The French Unicode export imported and ran on the separate loopback host. This provides meaningful WordPress/H5P portability evidence but does not establish support on untested LMS products or managed services.
