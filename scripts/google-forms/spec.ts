/**
 * The Google Forms built to test the Google Forms printout reader: what each
 * form holds, item by item, as Apps Script's FormApp builds it. The same spec
 * builds the forms (build.ts writes it into an Apps Script file) and is the
 * truth the printouts are checked against.
 */

export type Choice = { text: string; correct?: boolean }

export type Item =
  | { type: 'mc' | 'checkbox' | 'dropdown'; title: string; help?: string; points?: number; required?: boolean; choices: Choice[]; other?: boolean; feedback?: { correct?: string; incorrect?: string } }
  | { type: 'short' | 'paragraph'; title: string; help?: string; points?: number; required?: boolean }
  | { type: 'scale'; title: string; help?: string; low: number; high: number; lowLabel?: string; highLabel?: string; required?: boolean }
  | { type: 'grid' | 'checkgrid'; title: string; help?: string; rows: string[]; columns: string[]; required?: boolean }
  | { type: 'date' | 'time' | 'datetime' | 'duration'; title: string; help?: string; required?: boolean }
  | { type: 'section'; title: string; help?: string }
  | { type: 'page'; title: string; help?: string }
  | { type: 'image'; title: string; help?: string }
  | { type: 'video'; title: string; help?: string; url: string }

export type FormSpec = {
  /** The fixture's file name, without `.pdf`. */
  key: string
  /** Forms added after the first build, built by `buildRound2`. */
  round?: 2
  title: string
  description?: string
  quiz: boolean
  shuffle?: boolean
  items: Item[]
}

const mc = (title: string, choices: string[], correct: number, extra: Partial<Extract<Item, { choices: Choice[] }>> = {}): Item => ({
  type: 'mc',
  title,
  points: 1,
  choices: choices.map((text, index) => ({ text, ...(index === correct ? { correct: true } : {}) })),
  ...extra,
})

export const LOREM =
  'Photosynthesis takes place mostly in the leaves, where chloroplasts capture light energy and use it to turn carbon dioxide and water into glucose and oxygen. ' +
  'The light-dependent reactions happen in the thylakoid membranes, and the Calvin cycle happens in the stroma. '

const long = (sentences: number) => Array.from({ length: sentences }, () => LOREM).join('').trim()

const longQuiz: Item[] = Array.from({ length: 60 }, (_, index) => {
  const n = index + 1
  const stem = n % 7 === 0 ? `Question ${n}: ${long(3)} Which organelle is described?` : `What is ${n} × 3?`
  const choices =
    n % 7 === 0
      ? ['Chloroplast', 'Mitochondrion', 'Nucleus', 'Ribosome']
      : n % 11 === 0
        ? [`${n * 3}, because ${long(1)}`, `${n * 3 + 1}, because ${long(1)}`, `${n * 3 - 1}, because ${long(1)}`]
        : [String(n * 3 - 3), String(n * 3), String(n * 3 + 3), String(n * 3 + 6)]
  return mc(stem, choices, n % 7 === 0 ? 0 : n % 11 === 0 ? 0 : 1, { points: (n % 3) + 1 })
})

export const FORMS: FormSpec[] = [
  {
    key: 'mc-basic',
    title: 'Grade 6 Math Check-in',
    description: 'Ten multiple choice questions. Pick the one best answer.',
    quiz: true,
    items: [
      mc('What is 7 × 8?', ['54', '56', '64', '48'], 1),
      mc('Which fraction equals 0.5?', ['1/3', '2/5', '1/2'], 2),
      mc('What is the area of a 3 by 4 rectangle?', ['7', '12', '14'], 1, { points: 2 }),
      mc('Round 4.67 to the nearest tenth.', ['4.6', '4.7', '5.0', '4.67'], 1),
      mc('Which is a prime number?', ['21', '27', '29', '33'], 2),
      mc('What is 15% of 200?', ['15', '30', '20', '3'], 1),
      mc('How many sides does a hexagon have?', ['5', '6', '7', '8'], 1),
      mc('Solve: x + 5 = 12', ['x = 5', 'x = 7', 'x = 17'], 1, { required: true }),
      mc('Which is the greatest?', ['0.8', '0.75', '0.09', '0.799'], 0),
      mc('What is −3 + 8?', ['−11', '5', '−5', '11'], 1),
    ],
  },
  {
    key: 'all-types',
    title: 'Every Question Type',
    description: 'One of each kind of question Google Forms offers.',
    quiz: true,
    items: [
      mc('Multiple choice: which planet is largest?', ['Mars', 'Jupiter', 'Venus'], 1, { points: 2 }),
      { type: 'checkbox', title: 'Checkboxes: which are mammals?', points: 2, choices: [{ text: 'Whale', correct: true }, { text: 'Shark' }, { text: 'Bat', correct: true }, { text: 'Trout' }] },
      { type: 'dropdown', title: 'Dropdown: what is the capital of France?', points: 1, choices: [{ text: 'Lyon' }, { text: 'Paris', correct: true }, { text: 'Nice' }] },
      { type: 'short', title: 'Short answer: name the closest star to Earth.', points: 1 },
      { type: 'paragraph', title: 'Paragraph: explain why the sky is blue.', help: 'Two or three sentences.' },
      { type: 'scale', title: 'Linear scale: how confident are you?', low: 1, high: 5, lowLabel: 'Not at all', highLabel: 'Very' },
      { type: 'grid', title: 'Multiple choice grid: rate each topic', rows: ['Fractions', 'Decimals', 'Percents'], columns: ['Easy', 'Okay', 'Hard'] },
      { type: 'checkgrid', title: 'Checkbox grid: which days work?', rows: ['Morning', 'Afternoon'], columns: ['Mon', 'Tue', 'Wed'] },
      { type: 'date', title: 'Date: when were you born?' },
      { type: 'time', title: 'Time: when does school start?' },
      { type: 'datetime', title: 'Date and time: when is the test?' },
      { type: 'duration', title: 'Duration: how long did homework take?' },
    ],
  },
  {
    key: 'long-quiz',
    title: 'Long Review: Sixty Questions',
    description: 'A long quiz that runs across many printed pages.',
    quiz: true,
    items: longQuiz,
  },
  {
    key: 'sections',
    title: 'Cells Unit Test',
    description: 'Three parts. Read each part’s instructions.',
    quiz: true,
    items: [
      { type: 'section', title: 'Part A: Vocabulary', help: 'Match each word to its meaning.' },
      mc('The “powerhouse of the cell” is the…', ['nucleus', 'mitochondrion', 'cell wall'], 1),
      mc('The jelly-like fluid inside a cell is the…', ['cytoplasm', 'membrane', 'vacuole'], 0),
      { type: 'page', title: 'Part B: Diagrams', help: 'Answer from what you remember of the diagram in class.' },
      mc('Which part is only in plant cells?', ['Ribosome', 'Cell wall', 'Membrane'], 1),
      { type: 'checkbox', title: 'Which are organelles?', points: 2, choices: [{ text: 'Nucleus', correct: true }, { text: 'Glucose' }, { text: 'Golgi body', correct: true }] },
      { type: 'page', title: 'Part C: Short answer' },
      { type: 'short', title: 'What do ribosomes make?', points: 1 },
      { type: 'section', title: 'Bonus' },
      mc('Who first saw cells in cork?', ['Robert Hooke', 'Charles Darwin', 'Marie Curie'], 0, { points: 0 }),
    ],
  },
  {
    key: 'survey',
    title: 'Class Feedback Survey',
    description: 'Not a quiz: there are no right answers.',
    quiz: false,
    items: [
      { type: 'mc', title: 'How was today’s lesson?', choices: [{ text: 'Great' }, { text: 'Okay' }, { text: 'Confusing' }], other: true },
      { type: 'checkbox', title: 'What helped you learn?', choices: [{ text: 'Videos' }, { text: 'Group work' }, { text: 'Notes' }] },
      { type: 'dropdown', title: 'Which period are you in?', choices: [{ text: '1' }, { text: '2' }, { text: '3' }, { text: '4' }] },
      { type: 'short', title: 'One word for today:' },
      { type: 'paragraph', title: 'Anything else?' },
      { type: 'scale', title: 'How hard was the homework?', low: 0, high: 10 },
    ],
  },
  {
    key: 'tricky-text',
    title: 'Tricky Text — Ünïcödé & Symbols',
    description: 'Line one of the description.\nLine two, after a break.\n\nA paragraph after a blank line.',
    quiz: true,
    items: [
      mc('Which is equal to √16 + 2³?', ['12', '10', '24', '8 + 4 = 12'], 0),
      mc('Pick the inequality that is true: π ≥ 3.14 or π ≤ 3?', ['π ≥ 3.14', 'π ≤ 3', 'Neither'], 0),
      mc('Which emoji is a planet? 🌍🌙⭐', ['🌍', '🌙', '⭐'], 0),
      mc('Which word is Arabic for “book”?', ['كتاب', 'قلم', 'باب'], 0),
      mc('Which word is Hebrew for “peace”?', ['שלום', 'תודה', 'בית'], 0),
      mc('Options that look like numbering', ['1. First', 'A) Second', '(c) Third', '4) Fourth'], 2),
      mc('Which statement is right?', ['All of the above', 'None of the above', 'Both A and B'], 1),
      mc('A question\nwith a line break in it?', ['Yes', 'No'], 0),
      mc('Answer: is this a trick question? Correct answer: maybe', ['Correct answer', 'Incorrect', 'Points'], 0),
      mc('Visit https://example.com/quiz?q=1&a=2 — what does q equal?', ['1', '2'], 0),
      mc('“Smart quotes”, ‘apostrophes’ and — dashes – work?', ['Yes', 'No'], 0),
      mc('Trailing and   inner   spaces?  ', ['  padded  ', 'tight'], 1),
      mc('Accents: café, naïve, façade. Which is French for “coffee”?', ['café', 'thé', 'lait'], 0),
      mc('What is 1/2 + 1/4?', ['3/4', '2/6', '1/8'], 0, { help: 'Show your work on paper.\nThen choose.' }),
    ],
  },
  {
    key: 'media',
    title: 'Pictures and Videos',
    description: 'A quiz with an image and a video between the questions.',
    quiz: true,
    items: [
      mc('Before the picture: what colour is the sky?', ['Blue', 'Green'], 0),
      { type: 'image', title: 'A red square', help: 'Look at the picture, then answer below.' },
      mc('What colour was the square?', ['Red', 'Blue', 'Yellow'], 0),
      { type: 'video', title: 'A short video', help: 'Watch before answering.', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      mc('After the video: how many legs does a spider have?', ['6', '8', '10'], 1),
    ],
  },
  {
    key: 'feedback',
    title: 'Quiz With Feedback',
    quiz: true,
    items: [
      mc('Water boils at what temperature at sea level?', ['90 °C', '100 °C', '110 °C'], 1, { feedback: { correct: 'Right: 100 °C.', incorrect: 'Not quite. It boils at 100 °C at sea level.' } }),
      mc('Ice melts at…', ['0 °C', '10 °C'], 0, { feedback: { correct: 'Yes, 0 °C.' } }),
      { type: 'checkbox', title: 'Which are states of matter?', points: 3, choices: [{ text: 'Solid', correct: true }, { text: 'Liquid', correct: true }, { text: 'Heavy' }, { text: 'Gas', correct: true }], feedback: { incorrect: 'Solid, liquid and gas.' } },
    ],
  },
  {
    key: 'many-options',
    title: 'Many Options',
    quiz: true,
    items: [
      mc('Which US state is the largest by area?', Array.from({ length: 20 }, (_, i) => ['Alaska', 'Texas', 'California', 'Montana', 'New Mexico', 'Arizona', 'Nevada', 'Colorado', 'Oregon', 'Wyoming', 'Michigan', 'Minnesota', 'Utah', 'Idaho', 'Kansas', 'Nebraska', 'South Dakota', 'Washington', 'North Dakota', 'Oklahoma'][i]!), 0),
      { type: 'dropdown', title: 'Pick the number 23.', points: 1, choices: Array.from({ length: 30 }, (_, i) => ({ text: String(i + 1), ...(i === 22 ? { correct: true } : {}) })) },
      { type: 'checkbox', title: 'Which are even?', points: 2, choices: Array.from({ length: 12 }, (_, i) => ({ text: String(i + 1), ...((i + 1) % 2 === 0 ? { correct: true } : {}) })) },
    ],
  },
  {
    key: 'other-option',
    title: 'Other Option',
    quiz: false,
    items: [
      { type: 'mc', title: 'Favourite subject?', choices: [{ text: 'Math' }, { text: 'Science' }], other: true },
      { type: 'checkbox', title: 'Which sports do you play?', choices: [{ text: 'Soccer' }, { text: 'Basketball' }], other: true },
    ],
  },
  {
    key: 'empty',
    title: 'An Empty Quiz',
    description: 'This form has no questions yet.',
    quiz: true,
    items: [],
  },
  {
    key: 'huge-stem',
    title: 'One Very Long Question',
    quiz: true,
    items: [
      mc(`Read the passage. ${long(14)} Which process does the passage describe?`, [`Photosynthesis. ${long(2)}`, `Respiration. ${long(2)}`, `Digestion. ${long(2)}`, `Transpiration. ${long(2)}`], 0, { points: 5 }),
      mc('A short question after the long one: what gas do plants release?', ['Oxygen', 'Nitrogen', 'Helium'], 0),
    ],
  },
  {
    key: 'points-and-required',
    title: 'Points and Required',
    quiz: true,
    items: [
      mc('Worth zero points.', ['A', 'B'], 0, { points: 0 }),
      mc('Worth one point, required.', ['A', 'B'], 1, { points: 1, required: true }),
      mc('Worth one hundred points.', ['A', 'B', 'C'], 2, { points: 100 }),
      { type: 'short', title: 'Short answer worth 5, required.', points: 5, required: true },
      { type: 'checkbox', title: 'Checkboxes worth 10.', points: 10, required: true, choices: [{ text: 'X', correct: true }, { text: 'Y' }] },
    ],
  },
  {
    key: 'shuffled',
    title: 'Shuffled Question Order',
    description: 'Question order is shuffled for each respondent.',
    quiz: true,
    shuffle: true,
    items: [mc('First question?', ['Yes', 'No'], 0), mc('Second question?', ['Yes', 'No'], 1), mc('Third question?', ['Yes', 'No'], 0)],
  },
  {
    key: 'untitled',
    title: '',
    quiz: true,
    items: [mc('', ['Only choices, no question text', 'Second'], 0), mc('A question after an untitled one.', ['One', 'Two'], 1)],
  },
  {
    key: 'short-answers-tricky',
    round: 2,
    title: 'Short Answers With Tricky Text',
    description: 'Every question here is short answer or paragraph, so every one comes in.',
    quiz: true,
    items: [
      { type: 'short', title: 'Translate كتاب (Arabic) and שלום (Hebrew) into English.', points: 1 },
      { type: 'short', title: 'Which planet is shown? 🌍 🪐 🌙', help: 'Answer with one word 🙂', points: 1 },
      { type: 'short', title: 'Spacing:   three   spaces   between   words.' },
      { type: 'paragraph', title: 'Explain the dash — and the en dash – in “quotes”.', help: 'First line of help.\nSecond line of help.\n\nA paragraph after a blank line.' },
      { type: 'short', title: 'A title with a manual\nline break in it.' },
      { type: 'short', title: 'Math: if f(x) = x² − 3x + 2 ≥ 0, for which x is √(x) ≤ π?' },
      { type: 'short', title: `A long question that wraps over several printed lines: ${long(2)} Name the cycle.`, required: true, points: 2 },
      { type: 'paragraph', title: 'Describe a state-of-the-art, well-thought-out, self-contained, second-to-none, up-to-date, one-of-a-kind, never-before-seen experiment-design-and-analysis-process in detail.' },
      { type: 'short', title: 'Open https://example.com/a/very/long/path/that/keeps/going/and/going/until/it/must/wrap/somewhere/on/the/printed/page?with=query&and=more and say what it shows.' },
      { type: 'short', title: '1. A title that itself starts with a number.' },
      { type: 'short', title: 'Answer: what does “Mark only one oval.” mean?' },
      { type: 'paragraph', title: 'Café, naïve, façade, jalapeño, Æsir, Øresund, Ångström, Straße, İstanbul, Đà Nẵng.' },
    ],
  },
  {
    key: 'long-description',
    round: 2,
    title: 'A Form With a Very Long Description',
    description: [long(4), 'Second paragraph: ' + long(3), '', 'Third paragraph after a blank line, with a list:', '1. first', '2. second', '- a dash item'].join('\n'),
    quiz: true,
    items: [
      { type: 'short', title: 'What is the description about?' },
      mc('And a choice question after it?', ['Yes', 'No'], 0),
    ],
  },
  {
    key: 'hundred-plus',
    round: 2,
    title: 'One Hundred and Twenty Questions',
    quiz: true,
    items: Array.from({ length: 120 }, (_, index): Item =>
      index % 3 === 0
        ? { type: 'short', title: `Short answer ${index + 1}: what is ${index + 1} + ${index + 1}?`, points: 1 }
        : mc(`Choice ${index + 1}: what is ${index + 1} − 1?`, [String(index), String(index + 1), String(index + 2)], 0),
    ),
  },
  {
    key: 'numbered-titles',
    round: 2,
    title: '2024 Final Review',
    description: '3 parts, 45 minutes.',
    quiz: true,
    items: [
      { type: 'section', title: '1. Introduction', help: '2 questions in this part.' },
      { type: 'short', title: 'What year is it?' },
      { type: 'image', title: '2) Diagram of a cell', help: '3. Look carefully.' },
      { type: 'short', title: 'How many parts does the diagram show?' },
      { type: 'page', title: '3 Review', help: '10. This is not a question number.' },
      { type: 'paragraph', title: '4.5 is a number. Is it a question number?' },
      { type: 'short', title: '12' },
    ],
  },
  {
    key: 'teacher-mix',
    round: 2,
    title: 'Unit 3 Quiz: Ecosystems',
    description: 'Name: ____________  Period: ____\nAnswer every question. Show your work where asked.',
    quiz: true,
    items: [
      mc('Which is a producer?', ['Grass', 'Rabbit', 'Hawk', 'Mushroom'], 0, { required: true }),
      { type: 'short', title: 'Name one decomposer.', points: 1, required: true },
      { type: 'checkbox', title: 'Which are abiotic factors?', points: 2, choices: [{ text: 'Sunlight', correct: true }, { text: 'Bacteria' }, { text: 'Water', correct: true }] },
      { type: 'paragraph', title: 'Draw and describe a food chain with four links.', help: 'Use arrows to show the flow of energy.', points: 4 },
      { type: 'dropdown', title: 'Energy at each level passes on about…', points: 1, choices: [{ text: '10%', correct: true }, { text: '50%' }, { text: '90%' }] },
      { type: 'short', title: 'What is a niche?', points: 2 },
      { type: 'scale', title: 'How well do you understand food webs?', low: 1, high: 4 },
      { type: 'paragraph', title: 'Why do food chains rarely have more than five links?', points: 3 },
    ],
  },
]
