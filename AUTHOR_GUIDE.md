# Author guide

## Create an activity

Choose **Find and Correct Errors** in the H5P editor. Add a task description, then author the exercise in Visual mode or Markup mode.

In Visual mode, select the erroneous word or phrase and choose **Mark as error**. For each target, enter one or more accepted corrections. Optional target overrides can replace the global points and penalties; leave an override blank to inherit the global value. A target can also have multiple hints, explanatory feedback and a maximum number of correction attempts (`0` means unlimited).

In Markup mode, write an error as `[displayed error|accepted answer]`. Separate alternatives with `||`:

```text
The students [was|were] ready.
She [did not went|did not go||didn't go] yesterday.
```

Escape a literal backslash, bracket or pipe with a backslash: `\\`, `\[`, `\]`, `\|`. Selecting any word inside a marked phrase opens one correction field for the whole phrase. Targets must not overlap or nest.

## Behaviour and scoring

The default score is one point for locating a target and one point for correcting it, with a 0.5-point penalty the first time each distinct correct fragment is selected. Scores never fall below zero. Identification, correction, incorrect-attempt and hint values can be set globally or per target. Penalties never change the maximum score.

Choose live validation or checking at Finish; total, remaining or hidden error counts; unlimited or bounded retries; when explanations appear; when solutions may be disclosed; and whether straight and typographic apostrophes count as equivalent. Auto-completion occurs only after every target is correctly resolved. Exhausting attempts does not falsely complete an activity.

H5P supplies the local score and xAPI statement. Which attempt an LMS gradebook retains—first, latest or best—is controlled by the host, not by this content type.

## Importing legacy exercises

Single paired import:

```powershell
node tools/import-hotpot.mjs exercise.jcl exercise.htm output.json
```

Batch preview, followed by an explicit write:

```powershell
npm.cmd run import:batch -- --input legacy-folder --output converted --preview
npm.cmd run import:batch -- --input legacy-folder --output converted --write
```

The batch report lists mappings, warnings and errors. Review and correct the generated editable JSON before copying it into an H5P item. Inputs are parsed as inert data; embedded scripts are never executed. Only supported Hot Potatoes JCloze / Find-it structures are accepted.

## Accessibility authoring tips

Keep instructions concise, make hints useful without revealing the answer, and avoid relying on colour in feedback text. Test keyboard order, 200% zoom and the intended language. A human screen-reader test script appears in `ACCESSIBILITY_REPORT.md`.
