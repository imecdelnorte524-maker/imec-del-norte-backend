# IMEC del Norte - Backend

API del sistema IMEC del Norte.

La documentacion principal del sistema completo esta en:

```text
../README.md
```

## Proyecto

- Tipo: backend.
- Stack: NestJS, TypeScript, TypeORM, PostgreSQL, Redis, BullMQ, Socket.IO y JWT.
- Puerto API: `4001`.
- Prefijo global: `/api`.
- Swagger: `/api/docs`.

## Comandos

```bash
npm install
npm run start:dev
npm run build
npm run test
npm run test:e2e
npm run migration:run
```

## Docker

```bash
docker-compose up -d --build
```

Servicios principales:

- `backend_api`
- `backend_worker`
- `postgres`
- `redis`

## Variables

Crear `.env` desde `.env.example`.

Variables base:

```env
PORT=4001
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=12345
DB_NAME=imec_del_norte
JWT_SECRET=change_me
REDIS_URL=redis://localhost:6379
```
