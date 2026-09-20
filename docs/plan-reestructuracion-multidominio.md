# Wealth OS — Plan de reestructuración multi-dominio (Finanzas + Daily Brief)

Hoja de ruta para pasar de lo que ya está **prototipado y validado** (mockup `docs/dashboard-mockup-v4.html` + canvas de Claude) a cambios reales en el repo. Este documento es solo planning — no se toca código hasta que quede confirmado.

Complementa `roadmap-finanzas-automaticas.md` (el motor de datos), `plan-tecnico-mvp.md` (stack y costos) y `especificacion-pantallas.md` (mockup → código de cada pantalla). Este documento cubre lo nuevo: el patrón de submenú, la reconciliación de saldo, la fusión con Daily Brief y la puesta en producción multi-usuario de Finanzas.

**Orden de las fases (decidido 2026-09-19):** A (quick wins independientes) → B (fusión con Brief) → C (Finanzas multi-usuario). El trabajo de contenido/features propio de Brief sigue avanzando en paralelo una vez que B aterriza — C no lo deja de lado, corre aparte.

## 0. Qué ya está validado (no reabrir esto)

- **Patrón de submenú (pills)**: pantallas con secciones complementarias (Presupuesto, Cuentas, Configuración, Movimientos) usan pills debajo del header para evitar scroll largo en mobile. Prototipado en `dashboard-mockup-v4.html`. En desktop las pills se ocultan y vuelve el grid de dos columnas de siempre (nada cambia ahí).
- **Selector de espacio (switcher)**: cada dominio mantiene su propia barra de navegación; un selector arriba (`Wealth OS` · `<Dominio> ⌄`) abre una hoja que permite cambiar de dominio. Validado primero en el canvas de Claude (mockup visual) y luego funcional en `dashboard-mockup-v4.html` (Finanzas ↔ Brief, con Brief como placeholder).
- Estas dos cosas son independientes entre sí: la primera es un refactor de UI dentro del repo actual; la segunda es la que implica mover carpetas/rutas.

## 1. Fase A — Quick wins independientes (bajo impacto)

Dos mejoras que no dependen una de la otra ni de la Fase B — se pueden agendar cuando el usuario diga "ahora sí, a código", en cualquier orden.

### 1.1 Patrón de submenú (pills)

**Alcance:** bajo impacto. No toca rutas ni estructura de carpetas — es un componente nuevo + refactor de las pantallas existentes.

| Pantalla | Pills propuestas | Componente/archivo afectado |
|---|---|---|
| Movimientos | Movimientos · Resumen | `src/app/movimientos/page.tsx` |
| Presupuesto | Categorías · Plan · Metas · Extras | `src/app/presupuesto/page.tsx` |
| Cuentas | Cuentas · Cobranzas · Deudas · Fondo | `src/app/cuentas/page.tsx` |
| Configuración | Categorías · Etiquetas · Reglas | `src/app/configuracion/ConfiguracionView.tsx` |

Tareas:
- [ ] Extraer un componente `TabPills` (o nombre similar) reutilizable en `src/components/`, con el estilo ya usado en el mockup (chip lleno = activo).
- [ ] En cada pantalla, agrupar las secciones existentes bajo un panel por pill (sin duplicar markup — mover lo que ya existe, no reescribirlo).
- [ ] Las pills solo cambian de comportamiento en mobile (`< 900px`); en desktop todos los paneles se muestran a la vez, igual que hoy.
- [ ] Ojo con el bug que salió en el mockup: si se usa el mismo atributo/clase para identificar la pill y el panel, una regla CSS demasiado amplia puede ocultar las pills entre sí. Separar claramente selector de "panel de contenido" vs. "botón de pill".

No requiere decisiones pendientes.

### 1.2 Reconciliación de saldo (transacción de ajuste)

**Alcance:** bajo impacto. Toca schema (una tabla ya existente + posible nuevo tipo de transacción) y una pantalla, sin afectar rutas.

**Problema que resuelve** (surgido de la conversación de 2026-09-19): hoy `saldoInicial` de una cuenta ([schema.ts:14](../src/db/schema.ts)) solo se escribe al crearla — el modal de edición en [CuentasView.tsx:140-168](../src/app/cuentas/CuentasView.tsx) solo permite cambiar nombre y billetera. Si el usuario se equivoca al poner el saldo inicial, o el saldo se descuadra porque un ingreso en efectivo nunca se registró, hoy no hay forma de corregirlo sin editar la BD a mano.

**Patrón ya existente a generalizar**: [`corregirDeudaTarjeta`](../src/db/queries.ts) (línea ~852) ya ajusta `saldoInicial` para que la deuda mostrada de una tarjeta cuadre con la realidad, calculando el delta contra el saldo derivado. Es el mismo lever, pero aplicado solo a tarjetas y sin dejar rastro de cuándo/por qué se corrigió.

**Diseño propuesto**: en vez de editar `saldoInicial` en silencio, agregar un tipo de transacción `ajuste` (junto a `'compra' | 'transferencia' | 'retiro' | 'pago_servicio' | 'pago_tarjeta_credito' | 'ingreso'` en `transacciones.tipo`). El usuario dice "mi saldo real de esta cuenta es X", la app calcula el delta contra `saldoCuenta()` y crea una transacción de ajuste por ese monto — excluida de ingresos/gastos reales (mismo criterio que ya usa `excluirDeGastoReal`/`excluida`), pero sí cuenta para el saldo de la cuenta. Queda visible en Movimientos como evidencia, en vez de ser un número invisible que cambió. `corregirDeudaTarjeta` puede migrarse al mismo mecanismo más adelante para no tener dos formas distintas de resolver el mismo problema, pero no es requisito para esta fase.

Tareas:
- [ ] Definir si `ajuste` es un valor nuevo de `transacciones.tipo` (recomendado, reusa toda la infraestructura existente) o una tabla aparte.
- [ ] Función `ajustarSaldoCuenta(cuentaId, saldoReal, nota)` en `src/db/queries.ts`: calcula el delta contra `saldoCuenta()` e inserta la transacción de ajuste.
- [ ] UI: en el modal de editar cuenta ([CuentasView.tsx](../src/app/cuentas/CuentasView.tsx)), agregar la opción "Corregir saldo actual" con un campo de nota obligatorio (para que quede claro en Movimientos por qué se hizo).
- [ ] Confirmar que `resumenMes`, `patrimonioHistorico` y cualquier otro cálculo que sume transacciones excluye `ajuste` de ingresos/gastos igual que excluye `ingreso`/transferencias internas donde corresponde.

No requiere decisiones pendientes de arquitectura — sí una de nombre/detalle menor (tipo nuevo vs. reuso de `excluida`), a resolver al implementar.

## 2. Fase B — Fusión de dominios (Finanzas + Daily Brief)

**Alcance:** alto impacto. Esta es la que mueve carpetas y rutas.

### 2.1 Decisiones de arquitectura — ✅ resueltas (2026-09-19)

| # | Decisión | Resuelto |
|---|---|---|
| 1 | Nombre del paraguas | **Wealth OS**. Confirmado además en código real, no solo en el mockup: `src/app/layout.tsx` ya tiene `metadata.title = "Wealth OS"` y `<span className="brand-mark">Wealth OS</span>` — es el nombre vigente, cero rework. |
| 2 | Routing del switcher | **Rutas reales**, con route groups de Next.js donde no hace falta prefijo de URL. |
| 3 | Base de datos | **Misma Turso, tablas nuevas** (`briefs`). Un solo cliente Drizzle/libSQL. |
| 4 | Autenticación de Brief | **Sí, Clerk también** — una sola sesión para todo el shell. |
| 5 | Alcance de la migración (todo de una vez vs. por partes) | **Todo de una vez** — confirmado 2026-09-19. |

### 2.2 Auditoría del repo Daily Brief actual (resumen ejecutivo)

Lectura completa de `4. Daily Brief/daily-intelligence-brief` antes de proponer nada. Hallazgo principal: **es una app muy chica y muy portable** — 21 archivos bajo `src/`, una sola tabla, sin auth, sin tests, sin un solo `"use client"` en todo el código (todo es Server Components). La complejidad real no está en el código, está en el prompt de Claude y en el schema de Zod que valida su salida.

- **Stack exacto**: Next 14.2.35, React 18.3.1, Tailwind 3.4.1 (config clásico con `content[]`), shadcn "new-york"/"neutral" (solo 5 primitivas vendoreadas: `badge`, `button` —no se usa en ningún lado—, `card`, `separator` sin Radix, `skeleton` —tampoco se usa—), `drizzle-orm@0.45.2` + `drizzle-kit@0.31.10` + `@libsql/client@0.18.0`, `zod@4.6.4`, `@anthropic-ai/sdk@0.125.0`.
- **Buena noticia de bajo riesgo**: Drizzle/libSQL/Zod/Anthropic SDK están en versiones **prácticamente idénticas** a las que ya usa Wealth OS (`drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`, `@libsql/client@0.18.0`, `zod@4.6.5`, `@anthropic-ai/sdk@0.126.0`) — cero fricción de versiones en la parte de datos e IA. El riesgo real está concentrado en Next 14→16 y Tailwind v3→v4/shadcn.
- **Rutas** (3 páginas + 1 API route, todas Server Components, todas `force-dynamic`):
  - `/` — brief de hoy (o mensaje "aún no hay brief" + link al último disponible).
  - `/historial` — lista de fechas con brief generado.
  - `/historial/[date]` — un brief pasado. **Usa `{ params }: { params: { date: string } }` síncrono — rompe en Next 15+/16, hay que await-earlo.**
  - `GET /api/generate-brief` — el cron. Chequea `Authorization: Bearer ${CRON_SECRET}`, evita duplicar si ya existe brief del día (salvo `?force=true`), llama a `generateBrief(date)`, guarda en `briefs`.
- **Tabla única `briefs`** (`src/db/schema.ts`):
  ```ts
  export const briefs = sqliteTable("briefs", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull().unique(),       // "YYYY-MM-DD" hora de Lima
    rawJson: text("raw_json").notNull(),          // JSON completo devuelto por Claude
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  });
  ```
  Diseño de "un solo JSON por fila" (no normalizado) — se mantiene igual en la migración, no hay razón para normalizar ahora.
- **Generación** (`src/lib/generate-brief.ts`): `claude-sonnet-5`, `max_tokens: 16000`, tool nativa `web_search_20250305` (`max_uses: 20`), prompt en español con pesos por tema (IA 20%, Cloud 20%, Negocios 15%, etc.) y el patrón **Hecho / Interpretación / Predicción** ya usado en el mockup (`docs/dashboard-mockup-v4.html`, dominio Brief). Extrae JSON tolerando fences de markdown, valida con `briefSchema.parse(...)` antes de guardar.
- **Cron** (`vercel.json`): `{"path": "/api/generate-brief", "schedule": "0 11 * * *"}` — 11:00 UTC = 06:00 hora de Lima. La ruta declara `export const maxDuration = 300;` — **ya documentado en el propio repo que esto requiere Vercel Pro** (Hobby limita a 60s).
- **Auth**: cero. Ni `middleware.ts`, ni Clerk, ni ninguna librería de auth. El único control de acceso es el bearer check de `CRON_SECRET` en la ruta del cron — eso se mantiene igual, es independiente de Clerk.
- **Sin migraciones generadas**: el repo usa `drizzle-kit push` (no `generate`/`migrate`), así que no hay carpeta `drizzle/` con SQL que portar — solo el shape del schema actual.

### 2.3 Estructura de carpetas bajo `src/app/` — ✅ aprobada (2026-09-19)

Un matiz importante sobre el punto 2.1.2 original: un route group `(nombre)` **no agrega segmento a la URL** — así que si Finanzas y Brief usaran cada uno su propio route group, ambos podrían intentar resolver `/` y Next.js lo rechaza ("You cannot have two parallel pages that resolve to the same path"). Por eso Brief necesita una carpeta **real** (`brief/`, no `(brief)/`) para vivir bajo `/brief/*`, mientras Finanzas conserva `/` sin prefijo (no rompe ningún link/bookmark que ya exista):

```
src/app/
  layout.tsx                     ← shell RAÍZ (nuevo contenido, ver §2.6): ClerkProvider + fonts +
                                     topbar con el botón del selector de espacio + <DomainSwitcherSheet/>
  globals.css                    ← se le agregan las clases del switcher y de Brief (mismas ya escritas en el mockup)

  (finanzas)/                    ← route group, NO agrega prefijo — "/" sigue siendo "/"
    layout.tsx                    ← lo que hoy vive en el layout raíz: <TopNav/>{children}<BottomNav/>
    page.tsx                      ← Inicio (se mueve tal cual desde src/app/page.tsx)
    movimientos/                  ← se mueve tal cual
    presupuesto/                  ← se mueve tal cual
    cuentas/                      ← se mueve tal cual
    configuracion/                ← se mueve tal cual

  brief/                         ← carpeta real → prefijo /brief en la URL
    layout.tsx                    ← nav propia de Brief (Hoy / Historial, ver mockup)
    page.tsx                      ← "/brief" (Hoy) — portado de Daily Brief's page.tsx
    historial/
      page.tsx                    ← "/brief/historial"
      [date]/page.tsx             ← "/brief/historial/[date]" — OJO: params pasa a ser Promise (§2.8)

  api/
    auth/gmail/...                ← sin cambios
    gmail/watch/...                ← sin cambios
    webhooks/gmail/...             ← sin cambios
    cron/
      gmail-watch-renew/          ← existente, sin cambios
      brief-generate/             ← NUEVO, portado de Daily Brief's /api/generate-brief
                                      (nombre elegido para calzar con el patrón ya usado y caer
                                      automáticamente bajo el matcher público /api/cron/(.*) de src/proxy.ts)
```

Por qué así y no de otra forma:
- **Cero URLs rotas**: nada de lo que ya existe en Finanzas cambia de ruta. Solo se reorganiza en carpetas (route group), que es invisible para el usuario y para cualquier link ya compartido.
- **`api/cron/brief-generate/`** en vez de mantener `api/generate-brief/`: tu `src/proxy.ts` ya tiene un matcher público `"/api/cron/(.*)"` que salta `auth.protect()` — namespacear ahí hace que el cron de Brief funcione sin tocar `proxy.ts`, igual que ya funciona `gmail-watch-renew`. Si prefieres mantener el nombre `generate-brief` en vez de `brief-generate`, es un cambio de una palabra, avísame.
- El layout raíz pasa a ser más delgado (solo shell compartido); cada dominio agrega su propia navegación en su propio `layout.tsx` anidado — patrón estándar de Next.js App Router, no hace falta nada custom.

### 2.4 Plan de migración de schema (Drizzle)

Siguiendo la convención que ya usa este repo (`db-migration-safety`, migraciones generadas con `drizzle-kit generate`, no `push`):

1. Agregar a `src/db/schema.ts` (mismo archivo, no uno nuevo — es donde ya viven todas las tablas de Finanzas):
   ```ts
   export const briefs = sqliteTable("briefs", {
     id: integer("id").primaryKey({ autoIncrement: true }),
     date: text("date").notNull().unique(),
     rawJson: text("raw_json").notNull(),
     createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
   });
   export type Brief = typeof briefs.$inferSelect;
   export type NewBrief = typeof briefs.$inferInsert;
   ```
   Se porta el shape tal cual — no hay razón para normalizar el JSON ahora (nadie más consume esas columnas todavía).
2. Correr `npm run db:generate` → produce `drizzle/00XX_<nombre>.sql` (siguiente número después de `0016_...`, hoy van 17 migraciones aplicadas).
3. Revisar el SQL generado (debe ser un `CREATE TABLE briefs (...)` limpio, sin tocar ninguna tabla existente) antes de `npm run db:migrate` — exactamente el checklist que pide `db-migration-safety`.
4. Sin colisión de nombres: no existe ninguna tabla `briefs` hoy en Finanzas OS.

### 2.5 Plan de portación de rutas/componentes

| Origen (Daily Brief) | Destino (Wealth OS) | Qué cambia |
|---|---|---|
| `src/app/page.tsx` | `src/app/brief/page.tsx` | Query igual (Drizzle/libSQL ya compatible); quitar `Card` de shadcn, usar `.card`/`.screen` ya existentes en `globals.css` (mismos tokens que ya diseñamos en el mockup: `--surface`, `--border`, `--ink*`). |
| `src/app/historial/page.tsx` | `src/app/brief/historial/page.tsx` | Igual que arriba — lista de fechas, cambia solo de shadcn `Card`/`Link` a las clases hand-rolled. |
| `src/app/historial/[date]/page.tsx` | `src/app/brief/historial/[date]/page.tsx` | **Requiere el fix de `params` async** (§2.8) — es el único archivo con un breaking change real de Next. |
| `src/app/api/generate-brief/route.ts` | `src/app/api/cron/brief-generate/route.ts` | Lógica igual; el bearer check de `CRON_SECRET` no cambia. Se mantiene `export const maxDuration = 300`. |
| `src/lib/generate-brief.ts` | `src/lib/brief/generate-brief.ts` (o `src/logic/brief-generate.ts`, para calzar con `src/logic/` que ya existe en Finanzas) | Sin cambios de lógica — mismo prompt, misma tool `web_search_20250305`, mismo modelo. Solo cambia el import path del cliente `db` (usa el `src/db/client.ts` de Finanzas, que ya expone el mismo patrón `drizzle(client, { schema })`). |
| `src/lib/brief-schema.ts` (Zod) | `src/lib/brief/brief-schema.ts` | Sin cambios — Zod v4 en ambos repos. |
| `src/lib/dates.ts` (`todayInLima()`, etc.) | `src/lib/brief/dates.ts` | Sin cambios — no depende de nada específico de Next 14. |
| `src/components/brief-view.tsx` (`BriefView`, `StoryCard`, `Section`) | `src/app/brief/BriefView.tsx` (mismo patrón que `PresupuestoView.tsx`, `CuentasView.tsx` — componente co-ubicado con su página, no en `src/components/`) | **Reescribir de shadcn+Tailwind utility classes a CSS hand-rolled**, reusando literalmente las clases que ya inventé para el dominio Brief del mockup (`.brief-catbar`, `.brief-catbar-legend`, `.brief-triad-row`/`.hecho`/`.interp`/`.predic`, `.brief-triad-tag`, `.brief-triad-text` — se portan de `dashboard-mockup-v4.html` a `globals.css` tal cual, ya están diseñadas y ya combinan bien con los tokens de dark mode existentes). |
| `src/components/ui/*` (badge, button, card, separator, skeleton) | — | **No se portan.** Ninguno aporta nada que `globals.css` no tenga ya (`.card`, pills, etc.); `button` y `skeleton` ni siquiera se usan hoy en Daily Brief. |
| `src/app/fonts/GeistVF.woff`, `GeistMonoVF.woff` | — | **No se portan.** Finanzas OS ya carga Fraunces + Public Sans vía `next/font/google` (mismas fuentes que ya usa el mockup de Brief) — no hace falta una tercera familia tipográfica para un solo dominio nuevo. |
| `src/app/layout.tsx` (fonts, metadata) | — | Se descarta — el layout raíz de Wealth OS ya cubre fonts/metadata para todo el shell. |
| `src/app/globals.css` (tokens shadcn HSL) | — | Se descarta — Brief pasa a usar los tokens de Finanzas (`--bg`, `--surface`, `--ink*`, `--accent*`, `--cat-*`), que además ya tienen soporte dark mode (Daily Brief no tenía). |

### 2.6 Shell compartido (selector de espacio)

Se porta el diseño ya construido y probado en `dashboard-mockup-v4.html` (clases `.domain-switch`, `.switcher-overlay`, `.switcher-sheet`, `.switcher-option`, etc. — copiar/adaptar tal cual a `globals.css`, ya están resueltas visualmente en light y dark).

Piezas nuevas en `src/components/`:
- **`DomainSwitcherButton.tsx`** (`"use client"`): botón "Wealth OS / Finanzas ⌄" (o "Brief ⌄"). Usa `usePathname()` para decidir la etiqueta activa (`pathname.startsWith("/brief")` → "Brief", si no → "Finanzas") y abre la hoja.
- **`DomainSwitcherSheet.tsx`** (`"use client"`): la hoja con overlay + opciones. A diferencia del mockup (que solo mostraba/ocultaba un `<div>`), acá cada opción es un `<Link href="/">` / `<Link href="/brief">` real — navegación de verdad, consistente con la decisión de rutas reales.
- Ambos viven en el `layout.tsx` raíz (fuera de los route groups), para que sean visibles y funcionen igual sin importar en qué dominio estés parado.

### 2.7 Plan de migración del cron

1. Agregar a `vercel.json` (el que ya existe, con `gmail-watch-renew`):
   ```json
   {
     "crons": [
       { "path": "/api/cron/gmail-watch-renew", "schedule": "0 6 * * 0" },
       { "path": "/api/cron/brief-generate", "schedule": "0 11 * * *" }
     ]
   }
   ```
2. `src/app/api/cron/brief-generate/route.ts` conserva `export const maxDuration = 300;` y el bearer check de `CRON_SECRET` — **no necesita pasar por Clerk** (mismo patrón que `gmail-watch-renew`, ya exento vía `src/proxy.ts`).
3. Variables de entorno nuevas a configurar en Vercel: `ANTHROPIC_API_KEY` (puede que Finanzas OS ya la tenga, si ya usa Claude para categorización — confirmar antes de duplicar), `CRON_SECRET` (puede reusarse el mismo que ya usa `gmail-watch-renew` si aplica, o uno propio — decidir al implementar).
4. **Costo real**: `maxDuration: 300` obliga a Vercel Pro (US$20/mes) en cuanto este cron se despliegue en este proyecto. Si Finanzas OS hoy corre en Hobby, este es el momento en que el costo de hosting deja de ser US$0.

### 2.8 Breaking changes Next 14 → 16 (aplicados a los 3 archivos reales que se portan)

- **`src/app/brief/historial/[date]/page.tsx`** — hoy: `{ params }: { params: { date: string } }`, uso síncrono `params.date`. **Cambiar a**: `{ params }: { params: Promise<{ date: string }> }` y `const { date } = await params;`. Es el único cambio de código obligatorio por versión de Next — todo lo demás portado es compatible.
- **React 18 → 19**: obligatorio por Next 16, pero nada en el código de Brief usa una API exclusiva de React 18 (no hay `useFormState`, ni componentes de clase) — riesgo bajo.
- **Metadata API**: Daily Brief solo exporta `metadata` estático, sin `viewport` separado — no aplica porque el layout raíz de Wealth OS ya define su propio `metadata`/`viewport`; el de Brief se descarta (§2.5).
- **Caching por defecto de fetch/route handlers**: cambió entre Next 14 y 15+ (rutas GET dejan de cachearse por defecto). Como las 3 páginas ya usan `export const dynamic = "force-dynamic"`, el comportamiento efectivo no cambia — se mantiene igual.
- **`next/font/local`**: no aplica — no se portan las fuentes locales de Brief (§2.5).
- Nada de Server Actions, nada de `next/image`, nada de `cookies()`/`headers()` en el código de Brief — no hay más superficie de riesgo por versión de Next.

### 2.9 Tailwind v3 → v4 / shadcn → CSS a mano

- El `tailwind.config.ts` de Daily Brief (con `content: [...]`) y sus `@tailwind base/components/utilities` en `globals.css` **no se portan** — Wealth OS ya está en Tailwind v4 (`@import "tailwindcss";`, sin config JS) y con sus propios tokens en `:root` (incluyendo dark mode, que Daily Brief no tenía).
- Los 5 componentes shadcn (`badge`, `button`, `card`, `separator`, `skeleton`) se descartan — ver tabla de §2.5. Todo lo que rendericen se reconstruye con las clases ya usadas en Finanzas (`.card`, `.section-head`, etc.) más las nuevas específicas de Brief que ya diseñamos en el mockup (`.brief-*`).
- Esto significa que `BriefView.tsx` es, en la práctica, una **reescritura visual** (misma lógica de datos, JSX nuevo) — no un copy-paste. Es el trabajo más grande de la Fase B en términos de horas, aunque el mockup ya resolvió cómo debe verse.

### 2.10 Alcance de la migración — ✅ decidido

**Todo de una vez**, confirmado 2026-09-19. Con el tamaño real ya auditado (21 archivos, 1 tabla, sin auth, sin tests — "portable en una sola sentada"), no hay código suficiente como para justificar el costo de mantener un puente/convivencia temporal con el stack viejo — media migración (rutas portadas pero `BriefView` todavía en shadcn) sería más trabajo neto que hacerlo completo de una sentada.

## 3. Fase C — Producción de Finanzas (multi-usuario real)

**Alcance:** alto impacto. Es lo que falta para poder invitar gente fuera de la casa a usar Finanzas OS con sus propios datos, aislados de los tuyos. Depende de que la Fase B ya haya aterrizado el shell compartido (mismo Clerk, mismo layout raíz) — no depende del contenido de Brief en sí, y no bloquea que Brief se siga mejorando en paralelo.

### 3.0 Contexto y decisiones ya tomadas (2026-09-19)

| # | Decisión | Resuelto |
|---|---|---|
| 1 | Escala de la marcha blanca | **≤10-20 usuarios, probablemente menos de 10.** |
| 2 | Relación entre usuarios | **Cada uno 100% independiente** — sin cuentas compartidas/familiares. Si esto cambia más adelante, evaluar Clerk Organizations en vez de extender el modelo simple de `userId`. |
| 3 | Control de acceso en marcha blanca | **Clerk en modo restringido (allowlist manual)** — sin sistema de invitaciones propio, se agrega cada correo a mano desde el dashboard de Clerk. |
| 4 | Verificación OAuth de Google | **Pospuesta indefinidamente.** `gmail.readonly` es scope restringido, pero Google permite hasta 100 "test users" agregados a mano en la consola sin pasar por verificación — cubre esta escala de sobra. Solo se vuelve bloqueante si se abre registro público sin invitación. |
| 5 | Cifrado de tokens de Gmail | **Desde el día uno**, no se deja para después — es barato hacerlo bien la primera vez y evita una migración posterior. |
| 6 | Roles dentro de la app | **Ninguno más que un flag admin para el dueño del producto** (para soporte/debug) — no hace falta nada más granular a esta escala. |

### 3.1 Auditoría — por qué hoy no soporta más de un usuario real

- **Cero aislamiento en BD**: ninguna tabla de `src/db/schema.ts` tiene `userId` — `cuentas`, `transacciones`, `categorias`, `tarjetas`, etc. son globales. `src/proxy.ts` exige login vía Clerk, pero una vez adentro cualquier usuario logueado lee y escribe las mismas filas que cualquier otro.
- **Un solo cliente de BD compartido**: `src/db/client.ts` abre una única conexión Turso para toda la app — no hay partición por usuario a nivel de conexión, todo el aislamiento tendría que vivir en cada query.
- **Gmail es de un solo usuario por diseño**: el refresh token vive en la variable de entorno `GOOGLE_REFRESH_TOKEN` (`src/gmail/client.ts`), y `gmailSyncState` es una fila única global (`src/db/schema.ts`). El webhook (`src/app/api/webhooks/gmail/route.ts`) **ya recibe `emailAddress` en cada notificación de Pub/Sub pero lo ignora** — usa siempre el mismo cliente y el mismo checkpoint de `historyId`, sin importar de qué buzón vino.
- **`/api/auth/gmail/start`** es un link que se visita a mano una sola vez desde el navegador del dueño del proyecto — no está ligado a ninguna sesión de Clerk, no puede repetirse por usuario tal como está.
- **El cron `gmail-watch-renew`** renueva un único `watch()` global (`src/gmail/watch.ts`) — no itera nada por usuario.
- **Sin seed / onboarding**: no hay categorías por defecto ni ningún flujo guiado para una cuenta recién creada — un usuario nuevo entra a pantallas completamente vacías sin pistas.

### 3.2 Multi-tenancy en BD

El bloqueante real — nada de lo demás importa si esto no está resuelto primero.

- Agregar `userId` (Clerk user id, string) a cada tabla que hoy es global: `cuentas`, `categorias`, `tarjetas`, `reglasCategorizacion`, `tags`, `metasCompra`, `fondoEmergencia`, `cobranzas`, `deudasManuales`, `configuracionIa`. Las tablas que cuelgan de una de estas por FK (`transacciones`, `identificadoresCuenta`, `comprasCuotas`, `pagosCuota`, `transaccionesTags`) se aíslan transitivamente vía el `userId` de su padre, pero conviene revisar caso por caso si conviene duplicar el campo para simplificar queries o dejarlo solo en el join.
- Cada función de `src/db/queries.ts` pasa a recibir/filtrar por `userId` (leído del `auth()` de Clerk en cada Server Action o página) — es un cambio mecánico pero extenso, toca prácticamente todo el archivo.
- Migraciones con `drizzle-kit generate` (no `push`), siguiendo `db-migration-safety` como el resto del repo.
- Falta decidir el plan para los datos ya existentes: lo más simple es asignar todo lo que hoy vive en la BD al `userId` del dueño del producto en la propia migración, ya que es el único usuario real hasta ahora.

### 3.3 Gmail por usuario ("dan el OK y ya")

- Nueva tabla `gmail_conexiones` (`userId`, `emailConectado`, `refreshToken` cifrado, `historyId`, `watchExpiration`) — reemplaza el env var `GOOGLE_REFRESH_TOKEN` + la fila única de `gmailSyncState`.
- `/api/auth/gmail/start` pasa a ser un botón "Conectar Gmail" en Configuración, ligado a la sesión de Clerk: manda el `userId` en el parámetro `state` (firmado) de la URL de consentimiento de Google.
- `/api/auth/gmail/callback` decodifica ese `state` y guarda el refresh token cifrado asociado a ese usuario.
- Cada usuario dispara su propio `watch()` de Gmail apuntando al mismo topic de Pub/Sub existente — Gmail permite que varios buzones apunten al mismo topic.
- El webhook usa el `emailAddress` que ya trae el payload (hoy ignorado) para resolver la conexión correcta en `gmail_conexiones` y usar su `historyId`/token, no el global.
- El cron `gmail-watch-renew` pasa de renovar un watch a iterar todas las conexiones activas.
- Antes de invitar a cada persona de la marcha blanca, agregar su correo como "test user" en la consola OAuth de Google (§3.0.4) — sin eso, el consentimiento no arranca.

### 3.4 Roles y seguridad

- **Marcha blanca**: allowlist de Clerk + aislamiento por `userId` alcanza. Un flag `admin` (en `publicMetadata` de Clerk, o en una tabla `usuarios` liviana si conviene tenerlo fuera de Clerk) solo para el dueño del producto, para soporte/debug sin acceso raw a la BD de cada quien.
- **Antes de abrir a público en general** (no bloquea la marcha blanca, pero hay que dejarlo agendado): cifrado de tokens ya resuelto desde el día uno (§3.0.5), rate limiting en los webhooks públicos, botón de "desconectar Gmail / borrar mi cuenta", política de privacidad (se está leyendo correo bancario de terceros), y recién ahí evaluar la verificación completa de Google si se decide abrir registro libre sin invitación.

### 3.5 Onboarding de usuario nuevo

- Definir un set de categorías por defecto a crear en el primer login (basado en las que ya usa Finanzas OS hoy, o una lista neutra).
- Estado vacío guiado en Inicio/Cuentas cuando el usuario no tiene ninguna cuenta todavía ("agrega tu primera cuenta para empezar").
- Revisar si algún otro dato de "fila única" (`configuracionIa`, `fondoEmergencia`) necesita un valor por defecto sensato para un usuario que nunca lo configuró.

**Pendiente de validar (agregado 2026-09-20): opciones para el seed de categorías + reglas base.** No se decide nada acá todavía, es material para la sesión de decisiones de §3.6.

Categorías — 3 fuentes candidatas, ya auditadas, hay que elegir/mezclar:
1. **Las 16 categorías reales de hoy en producción** (`bucket | nombre`): `ahorro|Ahorro`, `fijos|Servicios`, `fijos|Suscripciones`, `fijos|Tecnología`, `fijos|Vehículo`, `fijos|Vivienda`, `inversion|Inversión`, `libre|Alimentación`, `libre|Cuidado personal`, `libre|Entretenimiento`, `libre|Ingreso`, `libre|Otros`, `libre|Restaurantes`, `libre|Sin contabilizar` (con `excluirDeGastoReal`), `libre|Transporte`, `libre|Viajes`. Ventaja: ya validadas por el uso real. Riesgo: son las de UN usuario (dueño del producto) — "Vehículo"/"Viajes" pueden no aplicarle al primer amigo invitado (ej. el barbero que mencionaste, que necesita más categorías de *ingreso* de negocio que las de gasto personal de hoy).
2. **`scripts/seed-categorias.ts`** (ya existe en el repo, pensado para setup inicial): 12 categorías, subset más neutro de la lista real — pero está desactualizado (le faltan Tecnología, Vehículo, Cuidado personal, Viajes, Sin contabilizar frente a lo que hoy existe en producción). Si se elige esta ruta, hay que decidir si se actualiza este script o se reemplaza por el seed de onboarding de C.4 directamente.
3. **Lista neutra desde cero**, pensada para cualquier perfil (asalariado, freelance/negocio como el barbero) en vez de heredar las categorías personales del dueño del producto.

Reglas de categorización — mirar `src/categorizacion/reglas.ts` (Capa 1, `REGLAS_POR_COMERCIO`) para separar qué sí es reusable de lo que es 100% personal antes de decidir el seed:
- Genéricas / candidatas a regla base para cualquier usuario: `uber → Transporte`, `netflix|spotify|hbo|disney|youtube premium|icloud|apple.com/bill|smart fit → Suscripciones`, `oxxo|tambo|tottus|plaza vea|metro|wong|vivanda → Alimentación`, `plansalud|clinica|essalud|farmacia|botica → Salud` (cadenas/marcas peruanas conocidas, no dependen de quién las usa).
- 100% personales, NO deben ir en ningún seed compartido: `gabriel obregon → Alimentación`, `victor m. sanchez → Vehículo`, `^roma$ → Vehículo` (nombres propios/negocios específicos del dueño del producto).
- Este archivo es hoy un array hardcodeado global, no por usuario — antes de escribir el seed de C.4 conviene decidir si las reglas base viven en código (como ahora, pero solo con las genéricas) o se insertan como filas en `reglasCategorizacion` por usuario en el onboarding (más flexible, permite que cada quien las edite/borre después).

### 3.6 Decisiones pendientes antes de picar prompts

A diferencia de la Fase B, esta fase todavía no pasó por una sesión de decisiones cerradas — conviene hacer una (igual que se hizo para §2.1) antes de escribir prompts de ejecución tipo §6:

- ¿`userId` se guarda como el Clerk user id (string) directo en cada tabla, o se crea una tabla `usuarios` propia con FK? (la opción directa evita una tabla redundante; una tabla propia solo se justifica si el flag admin u otros metadatos de producto no quieren vivir en Clerk).
- Librería y esquema de cifrado para el refresh token de Gmail, y dónde vive la clave de cifrado (variable de entorno nueva).
- Categorías por defecto exactas del seed de onboarding.
- Nombre definitivo del tipo de transacción de ajuste de saldo (§1.2) si todavía no se implementó — impacta el filtrado de reportes que esta fase también toca.

## 4. Fases de ejecución

Las decisiones de §2.1 y la estructura de §2.3 ya están aprobadas para la Fase B. La Fase C (§3) todavía necesita su propia sesión de decisiones (§3.6) antes de generar prompts de ejecución como los de §6.

Orden recomendado:

1. **A.1 y A.2** (independientes entre sí, bajo riesgo, ya especificadas) — se pueden hacer en cualquier momento y en cualquier orden.
2. **B.1 → B.6** en secuencia (ver detalle abajo). B.2 (schema) no depende de B.1 y podría adelantarse, pero conviene mantener el orden para no perder el hilo de verificación incremental.
3. **C.1 → C.5** (multi-tenancy, Gmail por usuario, roles/seguridad, onboarding) una vez cerrada la sesión de decisiones de §3.6. Este es el trabajo más grande del plan porque toca casi todas las queries existentes.
4. El trabajo de contenido/features propio de Brief (mejorar el prompt, agregar secciones, etc.) **no espera a que termine la Fase C** — sigue su propio ritmo una vez que B está en producción, para no dejarlo de lado mientras se hace la puesta en producción de Finanzas.

Detalle de las sub-fases de B:

- **B.1 — Scaffolding de carpetas**: crear `(finanzas)/` y mover `page.tsx` + las 4 rutas existentes ahí sin cambiar una línea de código (solo mover archivos), más el `layout.tsx` de Finanzas con `TopNav`/`BottomNav`. Verificar que la app sigue funcionando exactamente igual antes de seguir.
- **B.2 — Schema de `briefs`**: §2.4 completo (agregar tabla, generar y correr migración). No depende de B.1.
- **B.3 — Shell compartido**: `DomainSwitcherButton` + `DomainSwitcherSheet` + CSS portado del mockup, en el layout raíz. En este punto Brief todavía no existe — el botón puede apuntar a un "/brief" que da 404, o se hace junto con B.4.
- **B.4 — Portar rutas y `BriefView`**: §2.5 y §2.9 completos — la carpeta `brief/` con sus 3 páginas + el componente reescrito.
- **B.5 — Cron**: §2.7 completo (ruta + `vercel.json` + env vars en Vercel + confirmar plan Pro).
- **B.6 — Verificación end-to-end**: navegar el shell completo en dev (`npm run dev`), confirmar Clerk protege `/brief/*` igual que el resto, confirmar que `/api/cron/brief-generate` sigue respondiendo solo con el bearer correcto, y solo entonces considerar tocar el repo original de Daily Brief (nunca antes de esto).

No se toca ni se borra nada de `4. Daily Brief/daily-intelligence-brief` hasta confirmar contigo que B.1–B.6 funcionan en este repo.

Sub-fases de C (a detallar con prompts una vez cerrada §3.6):

- **C.1** — Multi-tenancy en BD (§3.2): schema + migración + `userId` en cada query.
- **C.2** — Gmail por usuario (§3.3): tabla `gmail_conexiones`, flujo de conexión, ajuste de webhook y cron.
- **C.3** — Roles y seguridad de marcha blanca (§3.4): allowlist de Clerk, flag admin, cifrado de tokens.
- **C.4** — Onboarding de usuario nuevo (§3.5): seed de categorías, estados vacíos guiados.
- **C.5** — Verificación end-to-end con un usuario de prueba real (invitar a la primera persona de la marcha blanca y confirmar que su data queda completamente aislada de la tuya, incluyendo su propio Gmail).

## 5. Riesgos / dependencias

- Costo: Vercel Pro (US$20/mes) pasa a ser necesario en cuanto se mueva el cron de Brief a este proyecto (Fase B).
- El trabajo más grande de la Fase B no es técnico sino de diseño-a-código: reescribir `BriefView` sin shadcn (§2.9).
- La Fase C es el cambio de mayor superficie de todo el plan: `C.1` toca casi todas las funciones de `src/db/queries.ts` — riesgo de regresión en cada pantalla si algún query queda sin filtrar por `userId`. Conviene revisar pantalla por pantalla al terminar, no solo confiar en que el `WHERE` quedó en todos lados.
- `C.2` es un cambio de arquitectura del pipeline de Gmail, no solo de UI — mientras no esté, cualquier usuario nuevo solo puede registrar movimientos a mano (sin parseo automático de sus correos).
- Si en algún momento se decide abrir Finanzas OS a registro público sin invitación, la verificación OAuth de Google (§3.0.4) deja de estar pospuesta y se vuelve un trámite a meter en el roadmap con anticipación.
- Nada queda bloqueado por decisiones pendientes en A o B — sí quedan las de §3.6 antes de picar código de la Fase C.

## 6. Prompts de ejecución, en orden

Los prompts de A y B ya se pueden pegar directo en una sesión de Claude Code — todas sus decisiones están tomadas. Los de C se agregan a este documento después de cerrar la sesión de decisiones de §3.6 (mismo criterio que se siguió con B: no se escriben prompts de ejecución hasta que no queden ambigüedades de diseño).

**Orden recomendado**: A.1 y A.2 (en cualquier orden entre sí), después B.1→B.6 en secuencia, después C.1→C.5 en secuencia (una vez tenga sus propios prompts).

### Prompt 1 — Fase A.1: patrón de submenú (pills)

```
Implementa la Fase A.1 de docs/plan-reestructuracion-multidominio.md (sección 1.1): el
patrón de submenú (pills) en Movimientos, Presupuesto, Cuentas y Configuración, tal
como está prototipado en docs/dashboard-mockup-v4.html.

- Extrae un componente TabPills reutilizable en src/components/, con el estilo del
  mockup (chip lleno = activo).
- En cada pantalla, agrupa las secciones existentes bajo un panel por pill sin
  duplicar markup — mové lo que ya existe, no lo reescribas.
- Las pills solo cambian de comportamiento en mobile (<900px); en desktop todos los
  paneles se siguen mostrando a la vez, igual que hoy.
- Cuidado con el bug que salió en el mockup: si el panel de contenido y el botón de
  la pill comparten el mismo atributo/clase para el CSS de mostrar/ocultar, una
  regla demasiado amplia oculta las pills entre sí. Usá selectores distintos para
  "panel de contenido" (ej. .tab-panel) y "botón de pill".

Verificá en el navegador (mobile y desktop, las 4 pantallas) antes de dar por
terminado.
```

### Prompt 2 — Fase A.2: reconciliación de saldo (transacción de ajuste)

```
Implementa la Fase A.2 de docs/plan-reestructuracion-multidominio.md (sección 1.2):
una forma de corregir el saldo de una cuenta sin editar saldoInicial en silencio.

- Agregá 'ajuste' como valor válido de transacciones.tipo (ver src/db/schema.ts,
  comentario de la línea ~100 con los tipos existentes).
- Creá ajustarSaldoCuenta(cuentaId, saldoReal, nota) en src/db/queries.ts: calculá
  el delta entre saldoReal y el saldoCuenta() actual, e insertá una transacción de
  tipo 'ajuste' por ese monto, con la nota del usuario en descripcion.
- La transacción de ajuste debe excluirse de ingresos/gastos reales en resumenMes
  y cualquier otro cálculo que ya excluye 'ingreso'/transferencias internas, pero
  sí debe contar para saldoCuenta() (igual que cualquier otra transacción).
- En el modal de editar cuenta (src/app/cuentas/CuentasView.tsx), agregá la opción
  "Corregir saldo actual" con un campo de saldo real y un campo de nota obligatorio.
- Mirá el patrón ya existente de corregirDeudaTarjeta en src/db/queries.ts (~línea
  852) como referencia del cálculo de delta, aunque esta función es independiente
  y no reemplaza esa (que sigue siendo específica de tarjetas por ahora).

Verificá en el navegador: corregí el saldo de una cuenta con un valor mal puesto,
confirmá que el saldo mostrado cambia, que la transacción de ajuste aparece en
Movimientos con su nota, y que no se cuenta como ingreso/gasto en el resumen del
mes.
```

### Prompt 3 — Fase B.1: scaffolding de carpetas (route groups)

```
Ejecutá la fase B.1 de docs/plan-reestructuracion-multidominio.md (secciones 2.3 y
4): creá el route group src/app/(finanzas)/ y mové ahí page.tsx (Inicio) y las
carpetas movimientos/, presupuesto/, cuentas/, configuracion/ tal cual están —
solo mover archivos, sin cambiar código. Agregá un layout.tsx dentro de
(finanzas)/ con el TopNav/BottomNav que hoy vive en el layout raíz.

El layout raíz (src/app/layout.tsx) sigue teniendo ClerkProvider, fonts y el
topbar, pero SIN TopNav/BottomNav (eso pasa al layout del route group).

No crees todavía src/app/brief/ ni nada del selector de espacio — son fases
aparte (B.3 y B.4).

Verificá que la app compila y se ve exactamente igual que antes — todas las URLs
actuales (/, /movimientos, /presupuesto, /cuentas, /configuracion) deben seguir
respondiendo igual — antes de dar por terminado.
```

### Prompt 4 — Fase B.2: schema de `briefs`

```
Ejecutá la fase B.2 de docs/plan-reestructuracion-multidominio.md (sección 2.4):
agregá la tabla `briefs` a src/db/schema.ts con el shape documentado ahí (id,
date, rawJson, createdAt). Seguí la convención db-migration-safety de este repo:
drizzle-kit generate (no push), revisá el SQL generado antes de aplicar la
migración con npm run db:migrate. No toques ninguna tabla existente.
```

### Prompt 5 — Fase B.3: shell compartido (selector de espacio)

```
Ejecutá la fase B.3 de docs/plan-reestructuracion-multidominio.md (sección 2.6):
construí el selector de espacio compartido — DomainSwitcherButton y
DomainSwitcherSheet en src/components/ (ambos "use client") — portando el diseño
ya validado en docs/dashboard-mockup-v4.html (clases .domain-switch,
.switcher-overlay, .switcher-sheet, .switcher-option, etc. — copialas a
globals.css tal cual, ya están resueltas en light y dark).

A diferencia del mockup (que solo togglea visibilidad), cada opción del sheet
debe navegar con <Link href="/"> / <Link href="/brief"> reales, consistente con
la decisión de rutas reales. Montalos en el layout raíz (src/app/layout.tsx).

En este punto /brief todavía no existe — está bien que dé 404 hasta la fase B.4,
no bloquees por eso.
```

### Prompt 6 — Fase B.4: portar rutas y componentes de Brief

```
Ejecutá la fase B.4 de docs/plan-reestructuracion-multidominio.md (secciones 2.5,
2.8 y 2.9). Leé de nuevo el repo original en
"../4. Daily Brief/daily-intelligence-brief" si hace falta refrescar detalle.

Portá a src/app/brief/ siguiendo la tabla de mapeo de la sección 2.5:
- page.tsx, historial/page.tsx, historial/[date]/page.tsx — este último con el
  fix de params async de la sección 2.8 (params pasa a ser Promise en Next 16).
- Reescribí BriefView como src/app/brief/BriefView.tsx usando las clases ya
  diseñadas en el mockup (.brief-catbar, .brief-catbar-legend, .brief-triad-row/
  .hecho/.interp/.predic, etc.) en vez de shadcn/Tailwind v3.
- Portá también src/lib/generate-brief.ts, brief-schema.ts y dates.ts del repo
  original a src/lib/brief/ (o donde calce mejor con la convención de este repo),
  apuntando al cliente db de Finanzas OS en vez del suyo propio.

NO portes los componentes de src/components/ui/ del repo original (badge, button,
card, separator, skeleton) ni las fuentes locales Geist — no hacen falta, ya
existen equivalentes o no se usan.

No muevas ni borres nada del repo original de Daily Brief.
```

### Prompt 7 — Fase B.5: cron de generación

```
Ejecutá la fase B.5 de docs/plan-reestructuracion-multidominio.md (sección 2.7):
creá src/app/api/cron/brief-generate/route.ts portando la lógica de
generate-brief del repo de Daily Brief (mismo bearer check de CRON_SECRET, mismo
export const maxDuration = 300). Agregá la entrada al array crons de vercel.json
sin tocar la de gmail-watch-renew.

Listame las variables de entorno nuevas que hacen falta configurar en Vercel
(ANTHROPIC_API_KEY si no existe ya en este proyecto, CRON_SECRET) y recordame que
este cron requiere plan Vercel Pro por el maxDuration de 300s.
```

### Prompt 8 — Fase B.6: verificación end-to-end

```
Ejecutá la verificación end-to-end de la fase B.6 de
docs/plan-reestructuracion-multidominio.md: levantá npm run dev y navegá el shell
completo — Finanzas en / y Brief en /brief. Confirmá:
- El selector de espacio cambia de dominio correctamente en ambas direcciones.
- Clerk protege /brief/* igual que el resto de rutas (sin sesión no debe poder
  verse nada).
- /api/cron/brief-generate responde 401 sin el bearer correcto, y no rompe con
  uno válido (probalo con curl sin necesidad de una ANTHROPIC_API_KEY real, solo
  para validar el check de auth).

Recién después de que todo esto pase, preguntame si confirmo que ya se puede
tocar/archivar el repo original de Daily Brief — no lo toques antes de mi
confirmación.
```

### Prompts de la Fase C — pendientes

Se escriben recién después de cerrar la sesión de decisiones de §3.6 (mismo criterio usado con la Fase B: nada de prompts de ejecución mientras queden ambigüedades de diseño reales, para no improvisar sobre una migración que toca casi toda la BD).
