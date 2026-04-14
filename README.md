# Project INSPIRE

Project INSPIRE is a full-stack teaching support app with:

- Angular frontend in `frontend/`
- Node.js/Express backend in `backend/`
- Local JSON persistence in `backend/data/store.json`

## Repository Layout

- `frontend/` - Angular UI
- `backend/` - Express API and local persistence
- `reference/` - Large source documents used by the app (ignored in git by default)
- `prototype/` - prototype assets and mockups

## Quick Start

1. Install root dependencies:

   npm install

2. Install app dependencies (first-time setup):

   npm --prefix backend install
   npm --prefix frontend install

3. Run both frontend and backend from root:

   npm start

Default local URLs:

- Frontend: http://localhost:4200
- Backend: http://localhost:3000

## Environment

Create a root `.env` file (not committed):

- `OPENROUTER_API_KEY=your_key_here`
- `PORT=3000` (optional)
- `OPENROUTER_MAX_TOKENS=2400` (optional, controls maximum response length for lesson generation)
- `OPENROUTER_REFERENCE_CHUNKS=3` (optional, controls how many reference chunks are injected per generation request)

## Git Notes

The root `.gitignore` is configured to ignore:

- Secrets (`.env`, `.env.*`)
- Large reference files (`reference/`)
- Node/Python dependency folders and caches
- Build outputs, logs, lockfiles, and temporary editor files

If you need to version selected documents from `reference/`, remove or adjust that rule before commit.
