# English Review App

Turn a teacher's homework or review note into validated, child-friendly English practice.

The project is now a single deployable workspace:

```text
D:\dev\english-review-app
├─ backend/      Express API and generation services
├─ frontend/     React + Vite user app
├─ scripts/
├─ package.json
└─ README.md
```

## Quick Start

Install backend and frontend dependencies:

```bash
npm install
npm run install:frontend
```

Run local development:

```bash
npm run dev
```

Open:

```text
Frontend: http://127.0.0.1:5173/
Backend:  http://127.0.0.1:5000/health
```

## Production Build

Build the frontend:

```bash
npm run build
```

Start the backend:

```bash
npm start
```

When `frontend/dist` exists, the Express backend serves the built frontend directly, so deployment can expose a single service:

```text
http://127.0.0.1:5000/
```

## Current Architecture

- Frontend: React + Vite in `frontend/`
- Backend: Node.js + Express in `backend/`
- Homework analysis: AI-assisted when available, with rules and knowledge-base fallback
- Question generation: local typed renderer by default
- Quality gates: coverage and semantic failures block publishing
- History: stores complete PracticePackage data for reuse and traceability

## Question Types

The app currently uses exactly 11 question types:

1. `listen_pick_image`
2. `match_word_image`
3. `spell_word`
4. `read_aloud`
5. `listen_pick_word`
6. `listen_judge`
7. `fill_blank`
8. `word_order`
9. `translate_pick`
10. `dialogue_complete`
11. `mixed_challenge`

`letter_sound_trace` has been removed as a formal question type. Alphabet content can be handled later as教材内容 or skill coverage, but it is not part of the current type contract.

## Useful Commands

```bash
npm run build
npm run test
npm run acceptance
npm run acceptance:real
```

If npm cache permissions fail on Windows, use a project-local cache:

```bash
npm --prefix frontend install --cache .\.npm-cache --no-audit --no-fund
```
