.PHONY: up down logs migrate shell build

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

migrate:
	docker compose exec backend alembic upgrade head

shell:
	docker compose exec backend bash

build:
	docker compose build
