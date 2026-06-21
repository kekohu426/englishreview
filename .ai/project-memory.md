# English Review App - AI Project Memory

Last updated: 2026-06-18

This file is the single AI-facing project memory for this repository. Read it before changing code, prompts, tests, or integration behavior.

## 1. Project Snapshot

### Goal

Build a child-friendly English course review generator. A teacher or parent enters review requirements, and the backend generates structured practice content covering 12 question types.

### Current Phase

The repository is primarily a backend generation prototype. The backend structure, prompts, OPW2 knowledge loader, fallback type coverage, validators, mock generation, and acceptance scripts exist. As of 2026-06-16, the real LLM path has been acceptance-tested successfully with the muyuan.do Claude-compatible API.

### Current Priority

1. Use `npm run acceptance` for fast local acceptance.
2. Use `npm run acceptance:real` for live LLM acceptance.
3. Restore production question volume when needed.
4. Integrate a frontend using mock mode or the stable `/api/generate` contract.

### Known Blockers

- LLM API now works with `LLM_PROVIDER=claude`, `LLM_BASE_URL=https://muyuan.do`, and `LLM_MODEL=claude-opus-4-8` in local smoke testing.
- Real LLM acceptance is slower than mock mode: `node test_acceptance.js --real` completed successfully in about 83 seconds while producing 22 questions across all 12 types.
- `backend/validators/index.js` validates generated question structure before the server returns it.
- Several Chinese docs/comments display as mojibake in the terminal. Treat source code behavior and explicit filenames as stronger evidence than garbled prose.

### Not In Scope Yet

- Database persistence.
- User accounts.
- Deployment hardening.
- Production observability.
- Full frontend implementation inside this repository. The README/docs reference an external React/Vite frontend, but this repo currently contains only backend and support scripts.

## 2. Read Order For AI Work

For any task in this repo:

1. Read this file first.
2. For backend generation changes, read:
   - `backend/server.js`
   - `backend/config.js`
   - `backend/generators/stage1.js`
   - `backend/generators/stage2.js`
   - `backend/generators/fallback.js`
3. For prompt changes, read:
   - `prompts/VERSION_NOTES.md`
   - `prompts/stage1_balanced.md`
   - `prompts/stage2.md`
4. For testing changes, read:
   - `test.js`
   - `test_mini.js`
   - `test_ultra_mini.js`
   - `auto_test_loop.js`
5. For current status, compare:
   - `CURRENT_STATUS.md`
   - `docs/STATUS.md`
   - actual source files

If docs and code disagree, prefer the current source tree and note the mismatch.

## 3. Module Map

### Runtime Entry

- `backend/server.js`: Express server. Exposes:
  - `GET /health`
  - `POST /api/generate`
- `POST /api/generate` pipeline:
  1. Validate request body.
  2. Call Stage 1 planning.
  3. Apply fallback task coverage for all required question types.
  4. Call Stage 2 question generation.
  5. Assemble questions into frontend-facing modules.

### Configuration

- `backend/config.js`: Loads `.env` and exports LLM, server, OPW2, question type, and Stage 2 batching config.
- Important environment variables:
  - `LLM_PROVIDER`
  - `LLM_API_KEY`
  - `LLM_BASE_URL`
  - `LLM_MODEL`
  - `LLM_TIMEOUT_MS`
  - `LLM_MAX_TOKENS`
  - `PORT`
  - `HOST`
  - `OPW2_KB_PATH`
  - `MIN_QUESTIONS_PER_TYPE`
  - `STAGE2_BATCH_SIZE`
  - `STAGE2_DELAY_MS`

### Knowledge Base

- `backend/knowledge/opw2_loader.js`: Loads OPW2 JSON from `OPW2_KB_PATH`, caches parsed data in memory, and exposes lookup/format helpers.
- The authoritative tutorial knowledge base root is `D:/zhishiku/00_Inbox/笑笑英语/OPW2-文字提取`.
- This root is the OPW2 course/tutorial knowledge base, not merely a natural phonics word list.
- It contains per-unit markdown files, review files, picture dictionary/student card files, metadata, and `99_all-units.json`.
- The current backend loader reads the summarized JSON file at `OPW2_KB_PATH`, usually `D:/zhishiku/00_Inbox/笑笑英语/OPW2-文字提取/99_all-units.json`.
- Do not narrow product logic to "phonics only" when teacher input references textbook pages, songs, reviews, sentence patterns, sight words, picture dictionary, or other course materials from that root.
- Server startup exits if OPW2 loading fails.

### Generators

- `backend/generators/stage1.js`: Builds a planning prompt from `prompts/stage1_balanced.md`, injects OPW2 text and teacher input, calls the LLM, saves raw output to `debug_stage1_response.txt`, extracts JSON, and returns a plan.
- `backend/generators/fallback.js`: Ensures all configured question types have at least `config.questions.minPerType` tasks by adding fallback tasks from target words.
- `backend/generators/stage2.js`: Builds one prompt per task from `prompts/stage2.md`, calls the LLM in batches, parses JSON, and returns question objects.
- `backend/generators/mock.js`: Generates deterministic mock questions covering all 12 question types.
- `backend/validators/index.js`: Validates question shape, options, and key per-type fields.

### Prompts

- `prompts/stage1_balanced.md`: Current Stage 1 prompt used by code.
- `prompts/stage1_original_backup.md`: Longer reference prompt; may cause timeouts.
- `prompts/stage1_minimal.md`: Shorter debug prompt; lower quality.
- `prompts/stage2.md`: Per-task question generation prompt.
- `prompts/VERSION_NOTES.md`: Explains why the balanced Stage 1 prompt is current.

### Tests And Automation

- `test.js`: Calls `POST /api/generate`, validates returned module structure, and checks all 12 question types have at least 5 questions.
- `test_mini.js` and `test_ultra_mini.js`: Smaller test variants.
- `test_acceptance.js`: Unified acceptance check. By default it checks health and local mock generation; pass `--real` to call the live LLM API, and `--full` for 5-per-type acceptance.
- `auto_test_loop.js`: Runs periodic API tests and writes reports to `test-reports/`.
- `auto_fix_loop.js`: Attempts automatic fixes by editing config/prompt files. Use cautiously; it writes files programmatically and may make broad changes.

### Current Local Dev Settings

- `.env` is currently tuned for quick development verification:
  - `MIN_QUESTIONS_PER_TYPE=1`
  - `STAGE2_BATCH_SIZE=1`
  - `STAGE2_DELAY_MS=0`
  - `MOCK_GENERATION=false`
- For acceptance/full generation, set `MIN_QUESTIONS_PER_TYPE=5`. Expect much longer runtime and more LLM calls.

## 4. Required Question Types

The canonical list is in `backend/config.js`:

- `listen_pick_image`
- `match_word_image`
- `spell_word`
- `read_aloud`
- `listen_pick_word`
- `listen_judge`
- `fill_blank`
- `word_order`
- `translate_pick`
- `dialogue_complete`
- `mixed_challenge`
- `letter_sound_trace`

Current requirement: each type should have at least 5 questions unless the user explicitly changes this.

## 5. Module Assembly Contract

`backend/server.js` groups generated questions into modules:

- `m1`: listening selection types
- `m2`: word/image, spelling, translation types
- `m3`: listening judgment
- `m4`: fill blank and word order
- `m5`: read aloud
- `m6`: dialogue completion
- `m7`: letter sound trace
- `m8`: mixed challenge

The frontend-facing response shape is:

```json
{
  "modules": [
    {
      "module_id": "m1",
      "icon": "...",
      "title": "...",
      "goal": "...",
      "estimated_minutes": 5,
      "color": "#FF6B6B",
      "items": []
    }
  ]
}
```

## 6. Architecture Rules

### Allowed Flow

Request -> `server.js` -> Stage 1 planner -> fallback task completion -> Stage 2 question generator -> module assembly -> response.

### Boundaries

- `server.js` should orchestrate, validate request shape, and assemble response. Keep prompt logic inside generators.
- Stage 1 should produce task plans, not final questions.
- Stage 2 should produce one complete question object per task.
- OPW2 loading and formatting should stay in `backend/knowledge/opw2_loader.js`, but future expansion should treat the whole tutorial knowledge-base directory as source material, not only the phonics vocabulary extracted into JSON.
- Question type coverage fallback should stay in `backend/generators/fallback.js`.
- Validators, when implemented, should live under `backend/validators/` and be called after Stage 2 generation.

### Forbidden Coupling

- Do not directly hardcode OPW2 vocabulary or course scope inside generators when it can come from the OPW2 tutorial knowledge base.
- Do not bypass `ensureAllQuestionTypes` unless the requirement for 12-type coverage changes.
- Do not make Stage 2 depend on frontend component internals.
- Do not treat docs claiming a feature exists as sufficient proof; verify the source file exists and is integrated.

### Implementation Constraints

- This is an ES module Node project (`"type": "module"`).
- Keep CommonJS `require` out of runtime source unless converting the project deliberately.
- Avoid adding new frameworks until the backend contract is verified.
- Keep `.env` secrets out of committed docs and examples.

## 7. Current Risks

- Generation latency and API cost are now the main delivery risks.
- LLM JSON parsing is fragile: both Stage 1 and Stage 2 use simple brace extraction.
- Generated questions are validated before response, but validation is structural rather than pedagogical.
- Stage 2 batch size is currently 1 to reduce rate-limit risk, so full generation may be slow.
- `auto_fix_loop.js` can modify files automatically; review changes carefully if it is used.

## 8. Recommended Next Steps

1. Add retry and degraded fallback behavior for LLM API failures and malformed JSON.
2. Optimize Stage 2 batching or prompt strategy to reduce real generation runtime.
3. Run `npm run acceptance` for quick checks and `npm run acceptance:real` before user-facing demos.
4. Run `npm run acceptance:full` only when API budget/time is acceptable.

## 9. Conflict Policy

- If this file conflicts with code, trust code and update this file.
- If older docs conflict with current source files, trust current source files.
- If a task would cross the current boundary, make the smallest useful change and record the boundary decision here.

## 10. Universal Question Quality Rules / Root Cause Log

These rules were added after previewing generated textbook Unit 3 content. Do not fix only one unit. Future generation for any unit, any textbook, and any uploaded material must pass reusable semantic gates.

### Content Role Classification Is Required

- Do not treat all target words as plain objects.
- Classify words/concepts before planning and rendering:
  - person/family role
  - object
  - place/home
  - animal/pet
  - body part
  - sense/action verb
  - adjective/taste/color
  - grammar pattern
  - source/material label
- Question templates must match the content role.
- Bad example: `It is a grandfather.`
- Better example: `Who is he? He is my grandfather.`

### Source Labels Must Never Become Target Vocabulary

- Material words such as `textbook`, `unit`, `review`, `practice`, source aliases, file names, and routing labels must not become `target_words`.
- If they appear in teacher input, keep them only as source-routing clues.

### Image Question Eligibility Must Be Explicit

- `listen_pick_image` and `match_word_image` may only use words with valid frontend image assets or generated/available image keys.
- If the selected unit/material has no image asset for a target word, do not silently fallback to unrelated older words.
- The repair path must either use an image-safe target from the same confirmed scope, map to a known asset, or mark the task as not eligible for image rendering.
- Bad example: Unit 3 image questions falling back to Unit 1 words like `book`, `ball`, `box`, `scissors`, `markers`.

### OCR And Knowledge Extraction Must Be Cleaned

- Malformed OCR text must be rejected or repaired before it becomes required patterns or child-facing questions.
- Reject examples:
  - unmatched parentheses
  - broken words like `grandfathery`
  - spacing artifacts like `th is`, `yo u`
  - unresolved placeholders like `(Grandmother)`, `(house)`, `()y`
- OCR garbage should appear as a parent/source warning, not as a child question.

### Question Type Applicability Must Be Checked

- Coverage logic must not force every word into every question type blindly.
- Some word/type combinations need adapted templates; some should be assigned to another target.
- Family words can be used in dialogue/read/translate patterns such as `Who is he?`, but not as plain object image questions unless a valid image asset exists.

### Semantic Validation Must Run After Generation

- Structural validators are not enough. They previously passed questions that were grammatically shaped but pedagogically wrong.
- A semantic quality gate must check:
  - person words are not rendered with `It is a/an ...`
  - plural prompts do not use singular answers, and singular prompts do not use plural answers
  - fallback words are not outside the confirmed material scope
  - image keys are inside the selected scope and supported asset list
  - OCR garbage patterns are absent
  - answer/options semantically match the prompt
- Failed semantic checks must trigger local repair or block parent preview.

### Parent Preview Feedback Feeds The Gate

- Parent feedback types such as `超纲`, `答案不对`, `选项不合适`, and `题干不清楚` should be recorded with item id, source refs, and question data.
- Repeated feedback must become tests/rules, not only one-off deletions.
