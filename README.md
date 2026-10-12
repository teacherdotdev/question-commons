<h1 align="center">Every question bank,<br />one open spec.</h1>

<p align="center">
  Question Commons reads question files from Canvas, Moodle, Blackboard, Kahoot, Blooket, Quizlet and more into one
  versioned Question Bank format, so any tool can take a teacher's questions in.
</p>

<p align="center">
  <a href="https://questioncommons.com">questioncommons.com</a> ·
  <a href="#the-spec">Read the spec</a>
</p>

```bash
npm install @teacherdotdev/question-commons
```

> v0.1, in development: the spec and API may still change before 1.0.

<table>
<tr>
<th align="left"><code>biology.gift</code></th>
<th align="left"><code>readQuestionFile()</code> → Question Bank</th>
</tr>
<tr>
<td valign="top">

```
::Q1:: Which gas do plants take in? {
  =carbon dioxide
  ~oxygen
  ~nitrogen
  ####Plants use CO2 to make sugar.
}
```

</td>
<td valign="top">

```jsonc
{
  "format": "question-commons/question-bank",
  "version": "1.0.0",
  "name": "biology",
  "provenance": { "format": "gift", "fileName": "biology.gift" },
  "questions": [{
    "type": "multiple-choice",
    "stem": /* Which gas do plants take in? */,
    "choices": [
      { "content": /* carbon dioxide */, "correct": true },
      { "content": /* oxygen */, "correct": false },
      { "content": /* nitrogen */, "correct": false }
    ],
    "explanation": /* Plants use CO2 to make sugar. */,
    "provenance": { "line": 1, "number": 1 }
  }]
}
```

</td>
</tr>
</table>

## Reads the files teachers' tools write

Each Format is one tool's own layout: a file the tool exports, or a syntax it defines and imports. A file is first set
into its Shape, so an Excel workbook and a CSV are the same Table and a Word document is Text, and then read by every
Format of that Shape ([ADR-0006](docs/adr/0006-read-only-layouts-a-tool-defines.md)). A table laid out a teacher's own
way isn't a Format; copy it into a template a Format reads, such as Kahoot's or Class Gauntlet's. Quizlet's export, which
any two-column file looks like, is read only when an app asks for it.

<!-- formats: written by `bun run docs` from src/catalog.ts -->

| Shape | Format | Originator | File types |
| --- | --- | --- | --- |
| Table | Blackboard upload file (tab-delimited) | Blackboard | `.txt` `.tsv` `.tab` |
| Table | Brightspace (D2L) question CSV | Brightspace (D2L) | `.csv` |
| Table | Respondus CSV | Respondus | `.csv` `.txt` |
| Table | Blooket spreadsheet | Blooket | `.csv` `.xlsx` |
| Table | Class Gauntlet spreadsheet | Class Gauntlet | `.csv` `.tsv` `.txt` `.xlsx` |
| Table | Kahoot spreadsheet | Kahoot | `.xlsx` `.csv` |
| Table | Quizlet export | Quizlet | `.txt` |
| Text | Blackboard Test Generator text | Blackboard Test Generator | `.txt` `.text` `.docx` |
| Text | Respondus Standard text | Respondus | `.txt` `.docx` |
| Text | Aiken | Moodle | `.txt` `.aiken` `.docx` |
| Text | text2qti | text2qti | `.txt` `.md` |
| Text | Moodle GIFT | Moodle | `.gift` `.txt` `.docx` |
| Text | Anki export | Anki | `.txt` |
| XML | Blackboard pool file | Blackboard | `.dat` `.xml` |
| XML | QTI XML (Canvas, Brightspace, Blackboard and others) | IMS QTI | `.xml` `.qti` |
| XML | Moodle XML | Moodle | `.xml` |
| Package | Blackboard pool or test export | Blackboard | `.zip` |
| Package | QTI package (Canvas, Brightspace, Blackboard and others) | IMS QTI | `.zip` `.imscc` |

<!-- /formats -->

## How it reads

**Never changes a question.** A question comes in exactly as its file meant it, or it's left out with an issue saying
where and why. ([ADR-0003](docs/adr/0003-never-change-a-question-to-make-it-fit.md))

**Keeps every question type.** Multiple choice and answer, true/false, matching, fill in the blank, short answer,
numeric and ordering. ([ADR-0002](docs/adr/0002-keep-every-question-type-a-file-carries.md))

**Rules, not AI.** The same file always gives the same result. Nothing is sent anywhere. Runs in the browser, Node and
Bun. ([ADR-0004](docs/adr/0004-recognise-and-read-files-by-rules-alone.md))

**Says where it came from.** Every bank records its format and file, and every question its line in that file.

## The spec

A Question Bank is plain JSON: a name, its questions, and where they came from. It's described by a versioned JSON
Schema, and every bank names the version it follows:
[question-bank-1.0.0.schema.json](schema/question-bank-1.0.0.schema.json), also served at
https://questioncommons.com/schema/question-bank-1.0.0.schema.json.

```ts
import { readQuestionFile } from '@teacherdotdev/question-commons'

const reading = await readQuestionFile({
  name: file.name,
  bytes: new Uint8Array(await file.arrayBuffer()),
})

reading.format    // 'kahoot'
reading.banks     // QuestionBank[]
reading.pictures  // pictures the file carried
reading.issues    // what was left out, and why
```

The words used here are defined in [GLOSSARY.md](GLOSSARY.md), and the decisions behind them are in
[docs/adr](docs/adr).

## Developing

```bash
bun install
bun test        # every format, the schema, plainText and the built release
bun run build   # dist/: one ES module and its type definitions
```

---

Open source under Apache-2.0. Built by [teacher.dev](https://teacher.dev). Used by Test Parrot and Class Gauntlet.
