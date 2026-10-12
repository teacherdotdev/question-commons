---
status: accepted
---

# Recognise and read files by rules alone

Carried over from Test Parrot's ADR-0033, which this package now owns. Some teachers will not send their tests through an AI, so every Format is read with rules alone: the same Question File always gives the same Reading, nothing is sent anywhere, and the package needs no network. Google Forms, which can only be read by signing in to Google, and PDFs and photos, which need an AI to read, stay in the apps.

A Question File is recognised by scoring it against every Format and reading it with the few that score best. The Reading that combines the best score with the most questions brought in wins, and the other Formats it could be are offered, so an app can let a teacher read it as another Format. A Format's score comes from its own markers, such as a standalone `MC` line in the Blackboard Test Generator's text or `ANSWER: B` in Aiken. Where Formats share a layout, a fixed order breaks the tie.

XML is read with no DTD and no external entities. A ZIP is opened within fixed limits on entries, sizes and compression ratio, and an entry whose name leaves the archive is refused.
