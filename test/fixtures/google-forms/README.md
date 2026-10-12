# Google Forms printout fixtures

Real Google Forms output, made from forms built for these tests. What each
form holds, item by item, is `scripts/google-forms/spec.ts`; the tests check
the printouts against it.

1. `scripts/google-forms/build.ts` writes `build.gs` from `spec.ts`.
2. `build.gs`, run as Google Apps Script in a test Google account, builds
   every form in a Drive folder, “Question Commons fixtures”. Their ids, and
   where Google stored something other than the spec asked, are in
   `scripts/google-forms/fixtures.json` (`deviations`).
3. Each form's `/printform` page, as the signed-in editor shows it, was
   saved through `scripts/google-forms/receiver.ts`. Those pages hold the
   account's details and are not kept.
4. `scripts/google-forms/render.mjs` printed each saved page to PDF in
   Chromium on Letter paper: `<key>.pdf` plain, and `<key>.headers.pdf` with
   Chrome's header and footer (the date, the title, the form's address and
   page numbers). Chrome's own print dialog can't be automated, so this
   stands in for More → Print → Save as PDF.

A couple of printouts a teacher saved by hand from Chrome's print dialog
should be added when available.
