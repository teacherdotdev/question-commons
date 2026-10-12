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

> v0.1, in development: not yet published to npm.

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

## Reads the files teachers already have

17 formats, each recognised by its own markers and read by its own parser.

| Learning platforms | Classroom games | Test makers and text |
| --- | --- | --- |
| Canvas | Kahoot | Respondus text and CSV |
| Moodle XML, GIFT and Aiken | Blooket | Blackboard Test Generator |
| Blackboard pools, exports and uploads | Class Gauntlet | text2qti |
| Brightspace (D2L) | Quizlet and Anki | CSV and Excel spreadsheets |
| QTI 1.2, 2.x and 3.0 | | Word documents |

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
