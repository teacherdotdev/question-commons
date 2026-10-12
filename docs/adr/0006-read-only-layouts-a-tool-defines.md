---
status: accepted
---

# Read only layouts a tool defines, each from one Shape

A Question File is first set into its Shape (Text, Table, XML or Package), so an Excel workbook and a CSV are the same Table and a Word document is Text, and then read by every Format of that Shape. A Format is one originator's documented layout: a tool's export, or a syntax a tool defines and imports (GIFT, Aiken, Respondus Standard). Each Format is written once, whatever the file arrived as, and the formats teachers are told about are ones they can name.

We dropped the Format that guessed a teacher's own spreadsheet columns, though it read files nothing else could, because a guessed layout can't say for certain which answer is right, and listing “CSV and Excel spreadsheets” as a Format promised more than it could keep. Quizlet's export, which any two-column file looks like, is read only when an app asks for it.

## Consequences

- Setting a file into its Shape may drop presentation (bold, a worksheet's other sheets) but never what says which answer is right; a question that needed what was dropped is left out (ADR-0003).
- A teacher's own spreadsheet is copied into a template a Format reads, such as Class Gauntlet's or Kahoot's.
