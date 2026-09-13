# Wealth OS

Finanzas personales automatizadas: los correos del banco entran, el dashboard
se actualiza solo. Ver `docs/roadmap-finanzas-automaticas.md` para la
arquitectura completa, `docs/plan-tecnico-mvp.md` para el stack y costos, y
`docs/especificacion-pantallas.md` para el detalle pantalla por pantalla.

## Estado actual: Fase 0

Migración de Sheets a Turso + parser de Interbank. Nada de Gmail
Push/Pub/Sub todavía (eso es Fase 1).

## Setup local

```bash
npm install
cp .env.local.example .env.local   # completar con tu URL y token de Turso
npm run db:generate                # genera la migración SQL a partir de src/db/schema.ts
npm run db:migrate                 # la aplica contra tu base de Turso
npm run dev
```

## Estructura

- `src/db/schema.ts` — schema de Drizzle (cuentas, transacciones, categorías, tarjetas, cuotas).
- `src/db/client.ts` — cliente de Turso/libSQL.
- `correos-ejemplo/` — correos reales anonimizados usados para escribir los parsers (no se commitea, ver `.gitignore`).
