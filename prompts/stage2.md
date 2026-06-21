# Stage 2: Question Generator

You are generating one complete question object for a young learner English review app.
Return only valid JSON. Do not use markdown fences. Do not add prose.

## Global Rules

- `id` must equal the task `task_id`.
- `type` must equal the task `question_type`.
- Never output `letter_sound_trace`.
- `requirement_ids` must contain the task `kp_id`.
- Copy `source_refs` from the task.
- Copy `knowledge_tags` from the task.
- Copy `ability_targets` from the task.
- Use the task `target_word`, `target_sentence`, `generation_intent`, and `note` as the source of truth.
- Keep language child-safe and suitable for early English learners.
- If the task gives a `target_sentence`, use it directly unless the question type requires a blanked version.
- Every choice question must have at least 3 options except `listen_judge`, which has 2 options.
- Every choice question must have exactly one option with `is_correct: true`.
- Use only these image keys when an image is needed: book, bag, pencil, ruler, desk, chair, red, blue, yellow, green, apple, banana, orange, pear, cat, dog, fish, bird, hen, pen, bed.

## Grammar Guardrails

- Use `How much` for uncountable nouns.
- Use `How many` for countable plural nouns.
- Sentences for `word_order` must include a subject and a verb.
- Across `listen_judge` tasks in a batch, mix correct and incorrect examples. Do not make every `listen_judge` answer `Correct`.

## Required Output Shapes

Use one of these shapes according to task `question_type`.

```json
{
  "id": "same_as_task_id",
  "type": "listen_pick_image",
  "requirement_ids": ["same_as_kp_id"],
  "source_refs": ["copy_from_task"],
  "knowledge_tags": ["copy_from_task"],
  "ability_targets": ["copy_from_task"],
  "child_instruction": "Listen and choose.",
  "audio_text": "hen",
  "target_word": "hen",
  "options": [
    { "label": "hen", "text": "hen", "image_key": "hen", "is_correct": true },
    { "label": "pen", "text": "pen", "image_key": "pen", "is_correct": false },
    { "label": "bed", "text": "bed", "image_key": "bed", "is_correct": false }
  ],
  "explanation": "You heard hen."
}
```

For non-image types:

- `match_word_image`: include `word`, `word_translation`, and image `options`.
- `spell_word`: include `audio_text`, `spell_word`, `word_translation`, `letter_pool`.
- `read_aloud`: include `text`, `translation`, `pronunciation_target`, `pronunciation_focus`, `scene_key`, `role_name`, `role_icon`.
- `listen_pick_word`: include `audio_text` and text `options`.
- `listen_judge`: include `audio_text`, boolean `answer`, and Correct/Not correct `options`.
- `fill_blank`: include `sentence_parts`, `blank_answer`, and text `options`.
- `word_order`: include `sentence`, shuffled `words`, and `translation`.
- `translate_pick`: include `source_text`, `source_lang`, and text `options`.
- `dialogue_complete`: include `dialogue` with exactly one blank line and text `options`.
- `mixed_challenge`: include `audio_text` and text `options`.

## Task

```json
{{taskJson}}
```

Return only the matching question JSON object.
