run:

	make down-volumes && make build && make start

dev:
	docker-compose up --build -d 

start:
	docker-compose up -d

build:
	docker compose build --no-cache

down:
	docker-compose down

down-volumes:
	docker-compose down -v

logs:
	docker-compose logs -f backend

test:
	npm run build && rm -rf dist

migrate:
	npx cross-env DB_HOST=localhost NODE_ENV=development DB_NAME=imec_del_norte npm run typeorm -- migration:run -d src/data-source.ts

revert:
	npx cross-env DB_HOST=localhost NODE_ENV=development DB_NAME=imec_del_norte npm run typeorm -- migration:revert -d src/data-source.ts

migration-generate:
	npm cross-env DB_HOST=localhost NODE_ENV=development DB_NAME=imec_del_norte npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli-ts-node-commonjs.js migration:generate src/migrations/$(name) -d src/data-source.ts

db-migrate:
	docker-compose exec backend npm run migration:run

db-revert:
	docker-compose exec backend npm run migration:revert