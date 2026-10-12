import { deflateSync } from 'node:zlib'
import { FORMS, LOREM } from './spec'

/**
 * Writes build.gs: an Apps Script that builds every form in spec.ts in a new
 * Drive folder, “Question Commons fixtures”, and logs each form's id. Paste
 * it into a new Apps Script project and run `buildFixtures`.
 */

/** A solid red square as a PNG, for the image item. */
function redSquare(size = 96): string {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (bytes: Buffer) => {
    let c = 0xffffffff
    for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const sum = Buffer.alloc(4)
    sum.writeUInt32BE(crc(body))
    return Buffer.concat([length, body, sum])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 2, 0, 0, 0], 8)
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => [220, 30, 30]).flat())])
  const pixels = deflateSync(Buffer.concat(Array.from({ length: size }, () => row)))
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', pixels),
    chunk('IEND', Buffer.alloc(0)),
  ]).toString('base64')
}

const script = `// Written by scripts/google-forms/build.ts from spec.ts. Run buildFixtures.
const LOREM = ${JSON.stringify(LOREM)};
const SPEC = JSON.parse(${JSON.stringify(JSON.stringify(FORMS).split(LOREM).join('§'))}.split('§').join(LOREM));
const RED_SQUARE = '${redSquare()}';

function feedback(text) {
  return FormApp.createFeedback().setText(text).build();
}

function addItem(form, spec, quiz) {
  let item;
  switch (spec.type) {
    case 'mc':
    case 'checkbox':
    case 'dropdown': {
      item = spec.type === 'mc' ? form.addMultipleChoiceItem() : spec.type === 'checkbox' ? form.addCheckboxItem() : form.addListItem();
      item.setChoices(spec.choices.map((c) => (quiz ? item.createChoice(c.text, !!c.correct) : item.createChoice(c.text))));
      if (spec.other) item.showOtherOption(true);
      if (quiz && spec.feedback && spec.feedback.correct) item.setFeedbackForCorrect(feedback(spec.feedback.correct));
      if (quiz && spec.feedback && spec.feedback.incorrect) item.setFeedbackForIncorrect(feedback(spec.feedback.incorrect));
      break;
    }
    case 'short': item = form.addTextItem(); break;
    case 'paragraph': item = form.addParagraphTextItem(); break;
    case 'scale': item = form.addScaleItem().setBounds(spec.low, spec.high).setLabels(spec.lowLabel || '', spec.highLabel || ''); break;
    case 'grid': item = form.addGridItem().setRows(spec.rows).setColumns(spec.columns); break;
    case 'checkgrid': item = form.addCheckboxGridItem().setRows(spec.rows).setColumns(spec.columns); break;
    case 'date': item = form.addDateItem(); break;
    case 'time': item = form.addTimeItem(); break;
    case 'datetime': item = form.addDateTimeItem(); break;
    case 'duration': item = form.addDurationItem(); break;
    case 'section': item = form.addSectionHeaderItem(); break;
    case 'page': item = form.addPageBreakItem(); break;
    case 'image': item = form.addImageItem().setImage(Utilities.newBlob(Utilities.base64Decode(RED_SQUARE), 'image/png', 'red.png')); break;
    case 'video': item = form.addVideoItem().setVideoUrl(spec.url); break;
  }
  item.setTitle(spec.title);
  if (spec.help) item.setHelpText(spec.help);
  if (quiz && spec.points !== undefined && item.setPoints) item.setPoints(spec.points);
  if (spec.required && item.setRequired) item.setRequired(true);
}

function fixturesFolder(fresh) {
  // Reuse the folder an earlier run made. A fresh build trashes only the
  // forms in it; a later round adds to them.
  const found = DriveApp.getFoldersByName('Question Commons fixtures');
  if (!found.hasNext()) return DriveApp.createFolder('Question Commons fixtures');
  const folder = found.next();
  if (fresh) {
    const files = folder.getFilesByType(MimeType.GOOGLE_FORMS);
    while (files.hasNext()) files.next().setTrashed(true);
  }
  return folder;
}

function attempt(issues, what, run) {
  try { run(); } catch (e) { issues.push(what + ': ' + e.message); }
}

/** Every form, from scratch. */
function buildFixtures() {
  build(SPEC, fixturesFolder(true));
}

/** Only the forms added in round 2, beside the ones already built. */
function buildRound2() {
  build(SPEC.filter((spec) => spec.round === 2), fixturesFolder(false));
}

function build(specs, folder) {
  const built = [];
  for (const spec of specs) {
    const issues = [];
    const form = FormApp.create(spec.title || 'Untitled form');
    DriveApp.getFileById(form.getId()).moveTo(folder);
    attempt(issues, 'setTitle(' + JSON.stringify(spec.title) + ')', () => form.setTitle(spec.title));
    if (spec.description) form.setDescription(spec.description);
    form.setIsQuiz(spec.quiz);
    if (spec.shuffle) form.setShuffleQuestions(true);
    spec.items.forEach((item, index) => attempt(issues, 'item ' + (index + 1) + ' (' + item.type + ')', () => addItem(form, item, spec.quiz)));
    attempt(issues, 'setPublished', () => form.setPublished(true));
    built.push(issues.length ? { key: spec.key, id: form.getId(), issues } : { key: spec.key, id: form.getId() });
    Logger.log(spec.key + ' ' + form.getId() + (issues.length ? ' ISSUES ' + issues.join(' | ') : ''));
  }
  Logger.log('FIXTURES ' + JSON.stringify(built));
}
`

await Bun.write(new URL('./build.gs', import.meta.url), script)
console.log(`build.gs: ${FORMS.length} forms, ${script.length} characters`)
