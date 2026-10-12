# Question Banks

Question Banks reads question files written for other tools into one unified, unsaved form that any teacher.dev app can take in, such as Test Parrot and Class Gauntlet. It reads; what an app keeps, saves or plays is up to the app.

## Language

### Files

**Question File**:
A file of questions written for another tool, such as a Kahoot or Blooket spreadsheet, a Canvas or Moodle export, or a Respondus text, or pasted text in one of those layouts.
_Avoid_: Foreign format, LMS export, legacy import, upload

**Format**:
One documented layout of Question File, named as teachers know it, such as “Kahoot spreadsheet” or “Moodle GIFT”.
_Avoid_: File type, parser, flavour

**Reading**:
What reading one Question File as one Format gives: one or more Question Banks and the Import Issues for whatever was left out.
_Avoid_: Parse result, import, conversion

**Import Issue**:
A question, or a part of a Question File, that was left out of a Reading, with where it was and why, in a teacher’s words. Nothing in a Reading is ever changed to make it fit; what cannot come in exactly is an Import Issue.
_Avoid_: Warning, error, note

### What a file holds

**Question Bank**:
A named group of Questions read from a Question File. One Question File may hold several. It is unsaved: an app that keeps one gives it its own identity and storage.
_Avoid_: Question set, quiz, pool, category, test

**Question**:
One question exactly as its Question File meant it, of one Question Type.
_Avoid_: Item, file question, foreign question

**Question Type**:
What a Question asks for: Multiple Choice, Multiple Answer, True/False, Matching, Fill in the Blank, Short Answer, Numeric, Ordering or Multipart. An app may take in only some of them.
_Avoid_: Question kind, answer kind, question format

**Multiple Answer**:
A Question Type where a student picks every choice that is right, of which there may be several.
_Avoid_: Select all that apply, multiple response, checkbox question

**Numeric**:
A Question Type whose answer is a number, optionally within a tolerance.
_Avoid_: Number question, calculated question

**Ordering**:
A Question Type where a student puts items into their correct order.
_Avoid_: Sequencing, ranking, sorting

**Extras**:
Facts a Question File carries about a Question Bank or a Question that are not part of the unified form, kept by name as the file gave them. An app may keep and pass them on, but never behaves differently because of them.
_Avoid_: Metadata, custom fields, tags

**Provenance**:
Where a Question Bank or a Question came from: the Format and Question File it was read from, and where in that file a Question was.
_Avoid_: Source, origin, history
