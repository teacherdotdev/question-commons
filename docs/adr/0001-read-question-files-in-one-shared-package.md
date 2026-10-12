---
status: accepted
---

# Read Question Files in one shared package

Test Parrot read fourteen Formats without AI (its ADR-0033), and Class Gauntlet read three spreadsheet layouts of its own, including Blooket's. Each app's readers knew Formats the other did not and got some wrong: Test Parrot read Blooket's `Question #` column as the question. Teachers asked both apps for the same Formats. So every Format is read once, in this package, into one unified Reading, and each app decides only what it takes in from it. Test Parrot maps Question Banks to its own six Question Types and stores them; Class Gauntlet keeps only single-choice Multiple Choice it can play.

## Considered Options

- **Readers only, with each app converting from every Format's own terms.** Rejected: each app would still decide how a Format's questions map to its own, so the apps would drift apart again, and a new app would start from nothing.
- **A copy of the readers in each app.** Rejected: copies drift. Class Gauntlet's and Happy Hallways’ copies of their connection code already have.

## Consequences

- The package is public and Apache-2.0, and apps install a tagged release from GitHub. A release tag holds the built JavaScript and its type definitions, so no app's build has to compile the package.
- The package only reads. Writing Formats, such as a Kahoot to Blooket converter, can be added later without changing the unified form.
- The unified form has a versioned specification and JSON Schema, and every Question Bank names the version it follows, so an app can tell what a saved one means apart from the package release that read it.
