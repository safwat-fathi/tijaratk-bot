.PHONY: run start worker test lint format migrate upgrade reset-db db-bash seed

run:
	uv run uvicorn app.main:app --host 0.0.0.0 --port 8000

start:
	uv run uvicorn app.main:app --reload

worker:
	uv run arq app.worker.WorkerSettings

test:
	uv run pytest

lint:
	uv run ruff check .

format:
	uv run ruff format .

migrate:
	uv run alembic revision --autogenerate -m "Migration"

upgrade:
	uv run alembic upgrade head

reset-db:
	PYTHONPATH=. uv run python scripts/reset_db.py
	uv run alembic upgrade head

seed:
	PYTHONPATH=. uv run python scripts/seed.py
