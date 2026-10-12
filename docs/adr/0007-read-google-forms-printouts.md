---
status: accepted
---

# Read Google Forms printouts, which carry no answer key

Teachers keep Google Forms as PDFs printed from the form editor (More → Print → Save as PDF). Google Forms itself can only be read by signing in to Google, which this package never does (ADR-0004), but its printout is a file one tool writes in one layout, so it is a Format (ADR-0006). It is read by rules alone from the PDF's text and where each piece of text stands on the page, through `unpdf` (Mozilla's PDF.js), loaded only when a file is a PDF. A PDF is its own Shape: its text is laid out on pages, not written in lines, so no Text Format reads it.

A printout never says which answer is right: the editor prints the form as a respondent sees it, with no answer key and no points. Under ADR-0003 a question whose right answer the file doesn't give is left out, so a printout's multiple choice, checkbox and dropdown questions are left out with an Import Issue saying so, and its short answer and paragraph questions come in as Short Answer. Linear scales, grids, dates and times are not Question Types and are left out too.

Still open: whether a choice question with no known answer should come in anyway, for an app to ask the teacher which answer is right. That would change ADR-0003 and the Question Bank spec.

## Consequences

- ADR-0004's “PDFs stay in the apps” now means every PDF but a Google Forms printout.
- Chrome's own header and footer (the date, the form's title, its address and page numbers), which a teacher may leave on when saving, are not part of the form and are skipped.
