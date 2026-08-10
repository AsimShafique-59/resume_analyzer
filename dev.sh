#!/usr/bin/env bash
# Runs backend (FastAPI) and frontend (Vite) together. Ctrl+C stops both.
set -e
cd "$(dirname "$0")"

trap 'kill 0' EXIT

(cd backend && .venv/bin/uvicorn app:app --reload --port 8000) &
(cd frontend && npm run dev) &

wait
