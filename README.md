# Question Commons

Every question bank, one open spec. `@question-commons/parser` reads question files written for other tools into one
unified, versioned Question Bank format, so any app can take a teacher's questions in.

**Status:** v0.1, in development. Not yet published to npm.

```ts
import { readQuestionFile, plainText } from '@question-commons/parser'

const reading = await readQuestionFile({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })

reading.format     // the Format it was read as, e.g. 'kahoot'
reading.banks      // QuestionBank[], each following schema/question-bank-1.0.0.schema.json
reading.pictures   // pictures the file carried, by the key rich text names them with
reading.issues     // what was left out, where, and why
reading.candidates // other Formats the file could be read as
```

## Formats

Canvas and QTI (1.2, 2.x, 3.0) · Moodle XML, GIFT and Aiken · Blackboard pools, exports and upload files · Blackboard
Test Generator text · Brightspace (D2L) CSV · Respondus text and CSV · text2qti · Kahoot · Blooket · Class Gauntlet ·
Quizlet and Anki · CSV and Excel spreadsheets · Word documents in any of the text Formats.

## How it reads

- **Never changes a question.** A question comes in exactly as its file meant it, or it's left out with an Import Issue
  ([ADR-0003](docs/adr/0003-never-change-a-question-to-make-it-fit.md)).
- **Keeps every Question Type** a file carries; each app decides what it takes in
  ([ADR-0002](docs/adr/0002-keep-every-question-type-a-file-carries.md)).
- **Rules, not AI.** The same file always gives the same Reading, and nothing is sent anywhere
  ([ADR-0004](docs/adr/0004-recognise-and-read-files-by-rules-alone.md)).

The words used here are defined in [GLOSSARY.md](GLOSSARY.md), and the decisions behind them are in [docs/adr](docs/adr).

## The spec

A Question Bank is plain JSON, described by [schema/question-bank-1.0.0.schema.json](schema/question-bank-1.0.0.schema.json),
also served at https://questioncommons.com/schema/question-bank-1.0.0.schema.json.

## Developing

```bash
bun install
bun test        # every Format, the schema, plainText and the built release
bun run build   # dist/: one ES module and its type definitions
```

Apache-2.0. Built by [teacher.dev](https://teacher.dev).
