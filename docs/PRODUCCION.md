# Produccion — Broco Finance

## Arquitectura resumida

- Next.js 14 App Router + Prisma + PostgreSQL
- Server Components para lecturas, Server Actions para mutaciones
- Autenticacion simple por contrasena de aplicacion (APP_PASSWORD)
- Sin usuarios, roles ni API routes financieras

## Variables requeridas

```env
DATABASE_URL=postgresql://...
APP_PASSWORD=...
SESSION_SECRET=...
```

## Preparacion de PostgreSQL

1. Crear base de datos vacia en PostgreSQL.
2. Configurar `DATABASE_URL` en `.env` de produccion.

## Aplicacion de migraciones

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
```

## Ejecucion del seed inicial

El seed esta protegido. Solo se ejecuta en entorno `NODE_ENV=test` con `ALLOW_DESTRUCTIVE_TEST_DB=true`.

Para aplicarlo en produccion (primera vez, base vacia):

```bash
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

Antes de ejecutar, verificar que la base esta vacia:

```bash
npx prisma db execute --stdin <<< "SELECT count(*) FROM clients;"
```

Si hay datos, no ejecutar el seed.

## Build

```bash
npm run build
```

## Despliegue

Configurar en Vercel (o el proveedor elegido):

1. Conectar repositorio.
2. Variables de entorno: `DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET`.
3. Comando de build: `prisma generate && next build`.
4. Comando post-deploy: `npx prisma migrate deploy`.
5. Dominio configurado.

## Smoke test posterior

1. Acceder a la URL.
2. Iniciar sesion con `APP_PASSWORD`.
3. Verificar Dashboard con datos.
4. Navegar Clientes, Proyectos, Ingresos, Gastos.
5. Confirmar conteos: 13 clientes, 18 proyectos, 22 ingresos, 46 gastos, 14 categorias.

## Respaldo previo a futuras migraciones

Antes de ejecutar `prisma migrate deploy`:

```bash
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql
```

## Rollback

```bash
git checkout <tag-anterior>
npx prisma migrate deploy  # Esto revierte a migraciones del tag anterior
# Restaurar datos desde backup si es necesario
```
