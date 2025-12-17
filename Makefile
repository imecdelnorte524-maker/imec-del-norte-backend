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

# MIGRACIONES CON DATA-SOURCE (FORMA CORRECTA)
migrate:
	npm run typeorm -- migration:run -d src/data-source.ts

revert:
	npm run typeorm -- migration:revert -d src/data-source.ts

migration-generate:
	npm run typeorm -- migration:generate -d src/data-source.ts -n

migration-create:
	npm run typeorm -- migration:create -d src/data-source.ts

# PARA DOCKER
db-migrate:
	docker-compose exec backend npm run typeorm -- migration:run -d src/data-source.ts

db-revert:
	docker-compose exec backend npm run typeorm -- migration:revert -d src/data-source.ts

add:
	git add .

push:
	git push origin main
