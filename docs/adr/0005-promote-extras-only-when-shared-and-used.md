---
status: accepted
---

# Promote Extras only when they are shared and used

Formats carry facts the unified form has no field for. Class Gauntlet's own files give each set a subject and a grade, which no other Format carries. Giving every such fact a field would grow the unified form one tool's quirk at a time. Allowing arbitrary keys alone would let the same idea arrive as “Grade”, “grade_level” and “Year”, and two apps would read one key two ways.

So a Question Bank and a Question have a fixed set of fields, plus Extras: text values kept under the names the file gave them. An app may keep and pass Extras on, but never behaves differently because of them. A fact becomes a field, in a minor version of the unified form, only when both are true:

1. at least two Formats carry it, so it is shared rather than one tool's quirk; and
2. at least one app acts on it, by showing it, filtering on it, or mapping it.

Subject and grade fail the first test, so they stay Extras for now. Class Gauntlet reads them back from its own files' Extras.

## Considered Options

- **Subject and grade as fields.** Rejected: only Class Gauntlet's files carry them.
- **Arbitrary key-value data and no fixed fields.** Rejected: no app could rely on a key, and the unified form would stop being one form.
