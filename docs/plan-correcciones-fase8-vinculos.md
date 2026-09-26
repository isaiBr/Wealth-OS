# Plan de correcciones — Fase 8+: vínculos entre movimientos y compromisos pendientes

## Contexto

Continuación del "plan de 7 fases de correcciones de producto" (ya implementado y commiteado en `main`, sin pushear — ver `git log`: selector de mes, filtros, últimos dígitos de cuenta, cuentas líquidas, cuotas manuales, auditoría de pago de tarjeta, metas con `montoAhorrado`, "sin contabilizar" solo por transacción, selector de categoría en 2 pasos, eliminar movimientos, confirmación antes de borrar).

Este documento recoge lo decidido en la sesión siguiente, después de probar esas fases a ojo: qué se simplifica, qué se agrega, y qué queda anotado para después pero no se construye todavía. Sirve de referencia para implementarlo en código — nada de esto está hecho aún, solo el mockup (`docs/dashboard-mockup-v5.html`) y este documento.

## Estado — retomar acá

- **Decisiones: cerradas** (todas las secciones de abajo, incluidos los dos ajustes de la última ronda: Metas se cubre también con "esto cubre algo"; Deuda = siempre pago único sin cuotas, si se fracciona va a Cuotas).
- **Mockup: `docs/dashboard-mockup-v5.html` — hecho y revisado**, incluye las 5 pantallas nuevas/ajustadas (formulario de movimiento con básico/avanzado + "esto cubre algo", Cuotas con día de pago y aviso, Cuentas separadas por tipo + alta completa, Deudas/Cobranzas con subpills Pendientes/Historial + menú "⋯" + paginación, acordeón de Configuración). Los formularios "Nuevo movimiento" y "Agregar cuenta" están ocultos por default y solo aparecen al tocar su botón (`+ Agregar gasto manual` / `+ Agregar cuenta`); "Más opciones" arranca retraído.
- **Código real: sin empezar.** Nada de lo de este documento está implementado todavía — es el siguiente paso de la próxima sesión.
- Ver también los "puntos fuera de alcance" al final — están anotados a propósito, no son pendientes.

### Próximos pasos sugeridos (orden razonable para implementar)

1. Schema: `compras_cuotas` (quitar `tarjeta_id` obligatorio, agregar `dia_pago`), `metas_compra` (dejar de depender de `categoria_id`, migrar progreso viejo a `montoAhorrado`, quitar opción "cuotas" del selector de método).
2. Formulario de movimiento: dividir en básico/avanzado (`<details>` colapsado por default, igual que en el mockup) + el selector "¿Esto cubre algo?" con sus acciones (reusa `alternarPagoCuotaMes`, `marcarDeudaManualPagada`, `marcarCobranzaCobrada`, `actualizarMontoAhorradoMeta`).
3. Cuotas: sacar el dropdown de tarjeta del alta, agregar día de pago + insight de vencimiento en Presupuesto.
4. Cuentas: agregar los campos de billetera/líquidas/últimos dígitos al formulario de creación (ya existen en edición).
5. Pulido visual: acordeón (flecha + sin punto + padding-left de las filas), separar cuentas/tarjetas, ícono de eliminar estandarizado + menú "⋯", historial de Deudas/Cobranzas recortado con subpills + paginación (mismo patrón que el mockup, con datos reales).

## Decisiones cerradas

### 1. Metas de compra

- Se elimina el mecanismo viejo (categoría autogenerada → progreso derivado de sumar movimientos en esa categoría). Antes de cortar la lógica, se migra el progreso acumulado de las metas viejas al campo `montoAhorrado`, para no perder el número.
- Se elimina el método de pago "cuotas" en metas — nunca llegó a un flujo usable (requería vincular a mano una compra en cuotas ya creada, nadie lo hacía).
- Las metas ahora también se pueden cubrir desde "¿Esto cubre algo?" en el formulario de movimiento (ver punto 4). `montoAhorrado` editable a mano sigue existiendo para cuando NO hay una transacción real de por medio (ej. "ya tenía esto apartado de antes").

### 2. Cuotas (compras en cuotas)

- Se desconectan por completo de `tarjetas`/`cuentas` — no se elige ninguna tarjeta al crear una cuota. Pasa a ser un tracker 100% manual: comercio, monto total, cantidad de cuotas, y un **día de pago** (no una tarjeta).
- `fechaCompra` fija se reemplaza (para el cálculo de vencimiento) por un campo **`diaPago`** (entero 1–31). La próxima fecha de vencimiento se calcula en vivo (día X de este mes, o del que viene si ya pasó) en vez de guardar una fecha que se desactualiza mes a mes.
- Aviso de vencimiento/atraso: una tarjetita/insight cerca de "Cuotas activas" en Presupuesto — quand falta poco para el día de pago, o cuando ya pasó sin marcarse pagada ese mes.
- **Cancelado** (ya no aplica): el fix que se había planeado de auto-crear una fila en `tarjetas` al dar de alta una cuenta tipo tarjeta de crédito. El bug original (el dropdown de "Agregar compra en cuotas" no dejaba elegir una tarjeta ya creada) deja de existir porque ya no hay dropdown de tarjeta.

### 3. Deudas

- Se define como un monto pendiente **único, sin cuotas ni fraccionamiento**. Si algo se va a pagar en partes (ej. "le debo 450 a mi amigo, quedamos en 3 cuotas de 150"), se registra directamente como una Cuota, no como Deuda.
- Idea futura, **no prioritaria, no se construye ahora**: permitir "fraccionar" una Deuda existente convirtiéndola en una Cuota, dejando un historial de cuánto se había pagado antes de la conversión. Queda anotada para revisar más adelante si hace falta.

### 4. "¿Esto cubre algo?" — vínculo unificado movimiento → compromiso pendiente

Vive dentro de "Opciones avanzadas" del formulario de movimiento (ver punto 5), no en el formulario básico.

Opciones según el tipo de movimiento:

- **Gasto** → "No" / "Una cuota de tarjeta" (multi-selección — un mismo pago suele cubrir varias cuotas activas del mes a la vez) / "Una deuda pendiente" (selección simple, una deuda = un pago completo) / "Una meta de compra" (selección simple).
- **Ingreso** → "No" / "Una cobranza pendiente" (selección simple) / "Una meta de compra" (selección simple).

Al guardar, dispara las **mismas acciones que ya existen a mano** hoy en cada pantalla: marcar cuota(s) pagada(s) este mes, marcar deuda pagada, marcar cobranza cobrada, o sumar el monto a `montoAhorrado` de la meta elegida. **No se guarda un vínculo relacional nuevo en la base de datos** — es un atajo en el server action del formulario que automatiza el toggle manual, no una tabla ni una FK nueva.

Solo se puede iniciar **desde el movimiento** (al crearlo o editarlo). No se construye la dirección inversa (asociar un movimiento ya existente desde la pantalla de Deuda/Cobranza/Cuota/Meta) en esta ronda — se evalúa después si de verdad hace falta (el caso de uso sería "me olvidé de marcarlo en el momento").

### 5. Formulario de movimiento — básico vs. avanzado

Para no seguir agregándole campos al formulario que se usa todo el tiempo:

- **Básico** (siempre visible): Tipo (Gasto/Ingreso), Monto, Comercio, Cuenta, Fecha.
- **Avanzado** (colapsado detrás de "+ Más opciones ▾", cerrado por default): Categoría (selector en 2 pasos, ya implementado), "Sin contabilizar" (ya implementado), y el nuevo "¿Esto cubre algo?" del punto 4.

### 6. Cuentas — paridad entre crear y editar

- El formulario de "Agregar cuenta" incorpora los mismos campos que hoy solo existen en "Editar cuenta": billetera (Yape/Plin), el toggle "Contar como plata líquida", y un campo simple de últimos dígitos (uno solo al crear, para no complicar el alta inicial — agregar más identificadores sigue disponible después, en "Editar").
- Los identificadores de cuenta (una cuenta puede tener varios) se dejan tal como están — el usuario decide más adelante si conviene limitarlos a uno por cuenta. Sin cambios de este lado.

## Pulido visual

Ya se había definido antes de esta sesión; se ejecuta junto con lo de arriba porque comparten las mismas pantallas.

- **Acordeón de Configuración** (categorías por bucket): la flecha de expandir/colapsar era casi invisible (bajo contraste) — se hace más clara. El punto de color al lado de cada categoría se saca — no aporta información en este contexto (todas las categorías activas tienen el mismo color).
- **Cuentas normales y tarjetas de crédito** en secciones/tarjetas separadas — puramente visual, la funcionalidad ya existe vía `cuenta.tipo`.
- **Ícono de eliminar estandarizado** en toda la app (un solo símbolo — tacho, no "✕" en unos lados y otro símbolo en otros). Las acciones de cada fila (editar, marcar pagado, eliminar) se agrupan en un menú "⋯" cuando son 3 o más, para no saturar la fila.
- **"Ya pagadas" (Deudas) / "Ya cobradas" (Cobranzas)**: hoy son un `<details>` que se expande sin límite — con meses de historial se vuelve una lista larguísima dentro de la misma pantalla. Se recorta a lo reciente (inline) + un link a una vista de historial aparte, con paginación. En esa vista de historial, el nombre pasa a ser clickeable (como ya lo es en "pendientes") para poder editar el monto — hoy en "ya pagadas/cobradas" solo se puede revertir o eliminar, no corregir el monto.
- **Pills de navegación visibles también en desktop** — hoy se esconden en pantallas grandes y en su lugar se muestra todo a la vez en dos columnas. Al meterle historial paginado a Deudas/Cobranzas (punto anterior), tiene sentido que las pills sean la forma real de navegar también en desktop, no solo en mobile. Se combinan con los filtros de mes/categoría/etiqueta que ya existen (Movimientos) y con paginación real en las vistas de historial.

## Fuera de alcance por ahora (anotado, no se construye en esta ronda)

- Fraccionar una Deuda existente convirtiéndola en Cuotas, con historial de la conversión.
- Asociar un movimiento ya existente desde la pantalla de Deuda/Cobranza/Cuota/Meta (dirección inversa del vínculo "¿esto cubre algo?").
- Decidir si un identificador de cuenta (últimos dígitos) debe limitarse a una sola cuenta o puede seguir siendo varios.
- Registrar un movimiento directamente como pago de cuotas desde el flujo de Yape/tarjeta automático (correos) — por ahora "¿esto cubre algo?" es manual, no se integra con el parser de Gmail.

## Implicancias de schema (referencia para cuando se implemente — todavía no hecho)

- `metas_compra`: deja de usarse `categoria_id` para calcular progreso (columna queda de legado, sin lógica; candidata a eliminarse en una limpieza futura una vez migrados los datos). `metodo_pago` pierde la opción `'cuotas'` (o se deja de ofrecer en el selector, aunque exista en datos viejos).
- `compras_cuotas`: `tarjeta_id` deja de ser obligatorio (o se elimina la columna/relación entera — a decidir al implementar, revisando si hay datos que dependan de ella). Nueva columna `dia_pago` (integer, 1–31) reemplaza el uso de `fecha_compra` para calcular la próxima fecha de vencimiento; `fecha_compra` se mantiene tal cual para "cuándo se hizo la compra".
- Vínculo "¿esto cubre algo?": **sin cambios de schema** — se resuelve en el server action del formulario de movimiento, reutilizando las funciones que ya existen (`alternarPagoCuotaMes`, `marcarDeudaManualPagada`, `marcarCobranzaCobrada`, `actualizarMontoAhorradoMeta`), no se crea tabla ni columna nueva.
- `cuentas`: sin cambios de schema, solo UI (agregar campos al formulario de creación que ya existen en el de edición).

## Referencia visual

`docs/dashboard-mockup-v5.html` — nueva versión del mockup con las pantallas que cambian: formulario de movimiento (básico + avanzado con "¿esto cubre algo?"), Cuotas activas con día de pago y aviso de vencimiento, Deudas/Cobranzas con ícono estandarizado y menú de fila, Cuentas separadas por tipo con formulario de alta completo, y navegación con pills + paginación en desktop.
