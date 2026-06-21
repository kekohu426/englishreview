# English Review App Design Notes

## Purpose

This file records the current product and UI design rules for the kids English review app. It is meant to keep future fixes aligned with the accepted user-side experience.

## Product Shape

- The app is a usable practice tool, not a landing page.
- Parent flow: paste teacher review requirements, generate practice.
- Child flow: enter ready modules, complete questions, move to the next ready module.
- The frontend visual style should continue matching `C:\Users\ke'ko\Downloads\User_greeting (2)`.
- Do not redesign the existing UI unless fixing a concrete bug or clarity issue.

## Visual Style

- Keep the current playful workbook/card style:
  - warm paper background
  - thick dark borders
  - offset shadows
  - high-contrast child-friendly colors
  - large tap targets
- Avoid system emoji for primary answer symbols when it looks generic or AI-generated.
  - Prefer lucide line icons in styled badge/label containers.
  - Example: `listen_judge` uses line `Check` and `X` inside colored stamp cards, not emoji check/cross.
- Keep buttons large and stable. Text and symbols must not resize or shift the layout during answer feedback.
- Do not put instructional explanation text on-screen unless it is part of the actual question or feedback.

## Module And Type Mapping

There are 12 user-facing modules, each mapped to one question type:

- `m1` -> `listen_pick_image`
- `m2` -> `listen_pick_word`
- `m3` -> `listen_judge`
- `m4` -> `mixed_challenge`
- `m5` -> `letter_sound_trace`
- `m6` -> `read_aloud`
- `m7` -> `word_order`
- `m8` -> `fill_blank`
- `m9` -> `match_word_image`
- `m10` -> `spell_word`
- `m11` -> `translate_pick`
- `m12` -> `dialogue_complete`

Each generated practice should provide at least 5 questions per type, for at least 60 questions total.

## Question Design Rules

### `listen_pick_word`

- This is not raw word recognition.
- It should be "listen to the question, choose the answer."
- Good examples:
  - `How many pens?` -> `Three pens.`
  - `How much milk?` -> `Some milk.`
  - `Can you spell yak?` -> `Y-A-K.`
- Bad examples:
  - prompt: `web`, options: `web / fan / bag`
  - any bare-word answer for a sentence/question prompt

### `listen_judge`

- The two visible options are always:
  - `Correct`
  - `Not correct`
- The UI should show a workbook-style check stamp for `Correct` and cross stamp for `Not correct`.
- Correct answers must not always be on the same side.
- Generated batches must include both `Correct` and `Not correct` as correct answers.
- The system should infer judgment from the sentence, not blindly trust the LLM:
  - `How much milk?` -> Correct
  - `How many pens?` -> Correct
  - `How many rice?` -> Not correct
  - `How many jams?` -> Not correct
  - `How much hens?` -> Not correct

### `fill_blank`

- Never split a word across the blank.
- Bad: `How many ____s?`, answer `ant`
- Good:
  - `How many ____?`, answer `ants`
  - `How ____ milk?`, answer `much`
  - `How ____ pens?`, answer `many`
- Do not create combined answers like `manymilk`, `manybags`, or `manyjam`.
- Options must not contain duplicates.

### `spell_word`

- The word itself must not be shown as a hint.
- The first N letters in `letter_pool` must not equal the answer.
- Letter buttons should be shuffled in backend generation and frontend rendering.
- Example: for `ant`, do not show `A N T ...` as the first three buttons.

### `translate_pick`

- If source text is English, the correct option should be Chinese.
- Do not expose grammar meta terms such as `countable noun` or `uncountable noun` to children.

### `dialogue_complete`

- Answers must be full dialogue replies, not bare words.
- Good:
  - `What do you have?` -> `I have some pens.`
  - `Can you spell cat?` -> `C-A-T.`
- Bad:
  - answer: `pens`
  - answer: `opw`

## Knowledge Scope

- Child-facing content must stay within teacher input plus the OPW2 tutorial knowledge base.
- The authoritative OPW2 tutorial knowledge base root is `D:\zhishiku\00_Inbox\笑笑英语\OPW2-文字提取`.
- This root is not just a natural phonics word list. It includes unit markdown, review lessons, picture dictionary, student cards, metadata, and the summarized `99_all-units.json`.
- The current backend reads `99_all-units.json`; generation logic should still respect the broader course scope when teacher input mentions textbook pages, songs, review units, sight words, sentence patterns, or other materials in the knowledge base.
- OPW2 Units 1-4 phonics words include:
  - Unit 1: `cat ant yak ax ram jam yam dam fan man pan can`
  - Unit 2: `dad pad bag rag cap map nap tap bat rat hat mat`
  - Unit 3: `web egg vet ten jet net wet pet hen pen red bed`
  - Unit 4: `hip ink zip in lip tip sip rip bib rib kid lid`
- Teacher-provided words such as `water`, `milk`, `corn`, `watermelon`, `cherry`, `pens`, and `jam` may be used when relevant.
- Do not show student-facing grammar labels:
  - `countable nouns`
  - `uncountable nouns`
  - `question and answer practice`
  - `OPW`

## Generation Architecture

- Stage1 may call the LLM to plan tasks.
- Stage2 API is disabled by design to avoid rate limits and JSON parsing failures.
- Stage2 local rendering converts sanitized Stage1 tasks into frontend-ready question data.
- If Stage1 returns invalid JSON or unusable output, use local safe fallback planning.
- New generation should cancel older active generation jobs.

## Quality Gates

The quality gate must reject or repair:

- Missing required question types.
- Fewer than 5 questions per type.
- Unknown question types.
- Missing required fields.
- Choice questions without exactly one correct answer.
- `listen_pick_word` with bare-word answers.
- `listen_judge` batches where all correct answers are on the same side.
- `fill_blank` word-splitting or glued answers.
- `spell_word` hint leakage or answer-ordered letter pools.
- `translate_pick` English source with non-Chinese correct option.
- `dialogue_complete` bare-word answers.
- Bad generated artifacts:
  - `howmanies`
  - `questionandanswerpractices`
  - `countable noun`
  - `uncountable noun`
  - `opw`

Run:

```bash
npm run quality:gate
```

Frontend build check:

```bash
npm run build
```

Run the frontend build command in:

```text
C:\Users\ke'ko\Downloads\User_greeting (2)
```

## Current Local URLs

- Backend: `http://127.0.0.1:5000`
- Frontend: `http://127.0.0.1:5173/`

After backend logic changes, restart the backend. After frontend component changes, Vite usually hot-reloads, but run a build before handoff.
