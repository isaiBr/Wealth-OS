# Wealth OS — Especificación de pantallas (mockup → código)

Puente entre `dashboard-mockup-v2.html` (el mockup navegable) y la implementación real. Por cada sección: qué muestra, de dónde sale el dato, qué acciones soporta, y con qué prioridad se construye. La arquitectura de fondo (parsers, dedupe, categorización) está en `roadmap-finanzas-automaticas.md`; el costo estimado está en `plan-tecnico-mvp.md`. Esto es la capa intermedia: la pantalla.

## Principio de diseño (importante para no repetir el error)

**Inicio es de solo lectura.** Muestra las métricas consolidadas que más importan de un vistazo — no tiene botones de agregar/editar/eliminar. Cualquier acción vive en la pestaña del dominio correspondiente.

**Cada pestaña adicional es una superficie de gestión de su dominio, no un espejo de Inicio.** Movimientos gestiona transacciones (agregar manual, filtrar, confirmar categorías sugeridas). Presupuesto gestiona el plan y los límites (editar metas, editar límite por categoría, editar/cancelar suscripciones). Cuentas gestiona el balance (agregar cuenta, editar saldo, editar meta del fondo de emergencia, agregar/editar deudas). Repetir gráficos de Inicio sin agregar una acción de gestión es la señal de que algo está en la pestaña equivocada.

## Prioridades de desarrollo por fase

Para no gastar tiempo de desarrollo en pulir interacciones que en el mockup existen solo para mostrar la arquitectura:

- **P0 — Bloqueante (Fase 0-1 del roadmap):** sin esto no hay producto. Parsers, dedupe, motor de transferencias internas, categorización (reglas + fallback Claude), storage en Turso. Nada de esto es una pantalla — es la data que las pantallas van a leer.
- **P1 — Dashboard funcional real:** Inicio y Movimientos en modo lectura, alimentados por datos reales de Turso. Agregar gasto manual (formulario real, no solo el botón). Esto ya es un producto usable día a día.
- **P2 — Gestión:** las acciones de edición de Presupuesto y Cuentas (editar límite de categoría, editar metas del plan de gasto, editar/agregar cuenta, editar meta del fondo de emergencia, agregar/editar deuda, confirmar o editar una suscripción). Necesario para que el sistema aprenda tus reglas, pero no bloquea el uso diario.
- **P3 — Pulido de interacción:** selector de mes real (hoy solo cambia el label, no re-consulta datos de otro mes), filtro de categoría en Movimientos con lógica real, chips/animaciones, "resumen del mes" en Movimientos con cálculo real. Esto es exactamente lo que en el mockup se ve "bonito" pero es cosmético — se prioriza después de que P0-P2 funcionen con datos reales.

La regla práctica: si una pantalla del mockup tiene una interacción que **no cambia qué datos ves** (el selector de mes, el filtro de categoría, los chips), es P3. Si **sí administra un dato real** (agregar/editar/eliminar), es P1 o P2 según si bloquea el uso diario.

## Inicio

Solo lectura. Todo lo que muestra ya vive en otra pestaña con más detalle y sus acciones — Inicio solo resume y enlaza (`data-goto`).

| Sección | Datos | Prioridad |
|---|---|---|
| Disponible real hoy | suma de saldos líquidos − fijos pendientes − cuotas del mes − apartado de ahorro | P1 |
| Patrimonio neto + rango (1M/3M/6M/1A) | serie histórica de patrimonio neto (snapshot mensual/semanal) | P1 (dato), P3 (selector de rango con datos reales) |
| Insights (icono + número + texto, hasta 4) | catálogo de reglas (>4) evaluadas contra el mes actual, se muestran las que disparan — ver §11 del roadmap | P2 (motor de reglas; no bloquea el uso diario) |
| Tu mes en números (4 stats) | ingreso, gasto real, tasa de ahorro (+ sparkline 6 meses), % gastos fijos — "Gastos fijos" es el mismo número que el bucket "Costos fijos" del Plan de gasto consciente | P1 |
| Compromisos recurrentes (3 chips con ícono) | total suscripciones/mes, total cuotas activas/mes, deuda pendiente — enlazan a Presupuesto/Cuentas | P1 |
| Gasto por categoría (donut) | agregación de transacciones del mes por categoría | P1 |
| Categorías a vigilar (top 2-3) | slice de "Presupuesto por categoría" ordenado por urgencia (ver §12 del roadmap) — no es una lista aparte | P1 (mismo cálculo que Presupuesto) |
| Plan de gasto consciente (condensado) | agregación por bucket (fijos/inversión/ahorro/libre) — nivel macro, distinto de "Presupuesto por categoría" (nivel fino); cada categoría se asigna a un bucket | P1 |
| Movimientos recientes (3) + "ver más" | últimas 3 transacciones | P1 |
| Cuentas (lista) + "ver fondo y deudas" | saldos reconstruidos por cuenta | P1 |

## Movimientos

Gestiona transacciones.

| Sección | Datos / acción | Prioridad |
|---|---|---|
| Filtro por categoría | dropdown nativo — filtra la lista visible | P3 |
| **+ Agregar gasto manual** | formulario: monto, comercio, categoría, cuenta, fecha — inserta una transacción real | **P1** (es la única vía de registro cuando algo no llega por correo) |
| Lista agrupada por día | todas las transacciones del mes, con categoría (confirmada o sugerida) | P1 |
| Categoría sugerida (pill punteada) | tocar abre el selector de categoría existente; confirma `categoria_confirmada=true` | P2 |
| **Editar transacción** | tocar un movimiento abre el mismo formulario de "+ Agregar gasto manual", pre-llenado (monto, comercio, categoría, cuenta, fecha) — permite corregir el monto real de un gasto compartido que se reembolsó por Yape/Plin (esas entradas no llegan por correo, ver roadmap; la corrección directa del monto es más simple que registrar cada reembolso entrante por separado, y mantiene el saldo reconstruido de la cuenta correcto siempre que el reembolso haya caído en la misma cuenta que pagó) | P1 |
| Resumen del mes (sidebar desktop) | ingresos, gastos, transferencias excluidas, categoría con más gasto | P3 |

## Presupuesto

Gestiona el plan de gasto y los compromisos recurrentes.

| Sección | Datos / acción | Prioridad |
|---|---|---|
| Plan de gasto consciente + "Editar metas" | % objetivo por bucket (fijos/inversión/ahorro/libre) — editable | P2 |
| Presupuesto por categoría + editar límite (lápiz) | límite mensual por categoría, editable; **ordenada por urgencia** (% usado descendente — ver §12 del roadmap), categorías sin movimiento al final. Para Servicios/Gasolina el límite sugerido es un promedio móvil de N meses, no un número fijo a ciegas (ver §10 del roadmap) | P1 (ver + orden), P2 (editar), P2 (promedio móvil + sugerencia de sobrante a ahorro) |
| Gasto hormiga anualizado | agregación de gastos chicos recurrentes, proyectada x12 | P1 |
| Suscripciones + "Editar"/cancelar | lista de suscripciones confirmadas (ver §8 del roadmap) | P1 (ver), P2 (editar/cancelar) |
| Cuotas activas + "marcar como pagada" | compras en cuotas activas, detectadas por el parser (ver §7 del roadmap). Se confirma pagada automáticamente al detectar el pago de la tarjeta (`pago_tarjeta_credito`), o manualmente si el parser no lo detecta | P1 (ver), P2 (confirmación automática + manual) |

## Cuentas

Gestiona el balance: lo que tienes y lo que debes.

| Sección | Datos / acción | Prioridad |
|---|---|---|
| Cuentas conectadas + editar (lápiz) | saldo reconstruido; editar = corregir saldo inicial/manual; tag opcional de billetera vinculada (Yape/Plin) | P1 (ver), P2 (editar), P2 (tag de billetera) |
| + Agregar cuenta manual | alta de una cuenta nueva (banco, alias, saldo inicial) | P2 |
| Fondo de emergencia + "Editar meta" | meta en meses de gastos fijos, editable | P1 (ver), P2 (editar meta) |
| Deudas + editar + "Agregar" + fecha de próximo pago | deuda(s) activas, método avalancha/snowball, alta de nueva deuda, fecha de vencimiento por tarjeta | P1 (ver, si aplica), P2 (editar/agregar), P2 (fecha de pago — base para la alerta de WhatsApp de Fase 2/3) |

## Notas de implementación (Next.js)

- 4 rutas (`/`, `/movimientos`, `/presupuesto`, `/cuentas`) en vez de las 4 `<div class="screen">` con `hidden` del mockup — el mockup usa ese truco solo para navegarse dentro de un único archivo HTML.
- Navegación: tab bar inferior en mobile, barra horizontal de pestañas arriba (debajo del topbar) en desktop — mismas 4 secciones, mismos íconos, ambas sincronizadas. La tab bar inferior no existe en desktop (no hay espacio de pulgar que resolver ahí); la de arriba no existe en mobile (no cabe junto al resto del header).
- El `dashboard-grid` (2 columnas en desktop) de Movimientos/Presupuesto/Cuentas es el mismo patrón visual que Inicio — mismo componente, contenido distinto por columna.
- Los botones de edición (lápiz, "Editar meta", "Editar") en el mockup no hacen nada — en código cada uno abre un formulario/modal simple sobre la tabla correspondiente (`categorias.limite`, `plan_gasto.metas`, `cuentas.saldo_inicial`, `fondo_emergencia.meta_meses`, `deudas`).
- El botón "marcar cuota como pagada" en Cuotas activas y el tipo `pago_tarjeta_credito` (§7 del roadmap) comparten la misma acción de fondo: avanzar el contador de cuota de esa tarjeta ese mes. La diferencia es solo el disparador (automático por parser vs. manual).
- `deudas.fecha_pago` es el campo nuevo que habilita la alerta de WhatsApp de Fase 2/3 ("tu tarjeta vence en 3 días") — no requiere nada más que guardarlo desde ya, aunque la alerta en sí sea de fase posterior.
- El motor de insights es un catálogo de reglas (function por regla: `evalúa(datos_mes) -> insight | null`), no 4 tarjetas hardcodeadas — Inicio pide "las N reglas que disparen este mes, ordenadas por prioridad".
- "Categorías a vigilar" (Inicio) y "Presupuesto por categoría" (Presupuesto) usan la misma función de orden (`ordenarPorUrgencia(categorias)`) — Inicio solo toma `.slice(0, 3)` del resultado. No se implementa dos veces.
- `cuentas.billetera` (`"yape" | "plin" | null`) es el campo que pinta el tag — no crea una fuente de datos nueva, Yape/Plin siguen sin API propia en este proyecto.
