# Finanzas Automáticas — Roadmap técnico

Extensión de Wealth OS: pasar de "yo disparo el proceso" a "corre solo, siempre", con dashboard en tiempo real y (más adelante) bot de WhatsApp.

## Arquitectura

### 1. Disparador automático (sin sesión de Claude)
- **Opción A — Gmail Push Notifications (Pub/Sub)**: `watch()` en la Gmail API notifica a un webhook cada vez que llega un correo. Real-time real. Requiere renovar el watch cada 7 días (se automatiza con un cron simple).
- **Opción B — Polling con cron**: función serverless (Vercel Cron / GitHub Actions) que cada 5–10 min llama `messages.list` filtrando por remitente y fecha.
- **Recomendación actualizada**: ir directo a la Opción A. El plan gratuito (Hobby) de Vercel solo permite cron **una vez al día** — no alcanza para un polling de 5-10 min sin pasar a Pro ($20/mes). Gmail Push solo necesita un cron de renovación semanal (1x cada 7 días), que sí cabe en Hobby, y además da latencia real (notificación apenas llega el correo) en vez de esperar el próximo ciclo de polling. Se salta la Opción B por completo.

### 2. Parsers por banco
Cada parser extrae: monto, moneda, comercio/destino, fecha, número de operación, tipo (compra / transferencia / retiro / pago de servicio).
- **BCP**: remitente `notificaciones@notificacionesbcp.com.pe` (ya identificado).
- **Interbank**: pendiente mapear remitente y formato del correo.
- **Banco Pichincha**: pendiente mapear remitente y formato (uso más esporádico, puede ir en fase 2 del parser).

Diseñar esto como un sistema de parsers "plug-in" (una interfaz común, un archivo por banco) para que sumar un banco nuevo no implique tocar el core — esto también es lo que te sirve el día que quieras vender esto a alguien que usa otro banco.

### 3. Deduplicación
Por número de operación (regla ya definida en Wealth OS). Se mantiene igual.

### 4. Transferencias entre tus propias cuentas
Motor de matching: si aparece un débito en una cuenta tuya y un crédito en otra cuenta tuya con mismo monto y fecha/hora cercana → se marca como `transferencia_interna` y se excluye de ingresos/gastos reales (si no, tu dashboard se infla artificialmente).

### 5. Categorización
- Capa 1: reglas por comercio/texto (mapa que va creciendo con el uso).
- Capa 2 (fallback): Claude API (Haiku, es solo clasificación de texto corto — no hace falta un modelo caro) categoriza lo que no matchea ninguna regla, y esa categorización se puede ir confirmando (eventualmente vía WhatsApp, fase 3).

### 6. Storage y dashboard
Turso (SQLite) + Drizzle, alimentando directo el dashboard Next.js que ya tienes en Growth OS — sin pasar por Sheets como intermediario. Sheets puede quedar como respaldo/export, no como fuente de verdad.

### 7. Gastos en cuotas
El parser debe reconocer el patrón "cuota X/Y" en el correo del banco (compras en cuotas son comunes en tarjetas peruanas). Implicancias:
- El "gasto real" del mes cuenta solo la cuota que vence ese mes, no el monto total de la compra.
- Se guarda el compromiso completo (cuántas cuotas quedan, monto total) para poder mostrar "cuotas activas" — esto afecta "disponible real hoy" igual que un gasto fijo, porque ya está comprometido.

**Confirmación de pago — el pago de la tarjeta es un tipo de transacción aparte.** El flujo real (como en la mayoría de tarjetas): pagas el estado de cuenta completo, que incluye tanto tus compras al contado como la cuota del mes de tus compras a plazos. Ese pago no es ni un gasto nuevo ni una `transferencia_interna` clásica (no hay una cuenta propia que reciba el crédito en los correos que parseamos) — es un tipo propio, `pago_tarjeta_credito`:
- El parser lo reconoce por patrón del correo (ej. "Pago de tarjeta de crédito VISA").
- Se excluye de "gasto real" (igual que una transferencia — el gasto ya se contó cuando se hizo la compra o mes a mes vía la cuota).
- Al detectarlo, se marca automáticamente como pagada la cuota de ese mes para esa tarjeta (avanza el contador, ej. cuota 3/6 → 4/6).
- Si el pago no llega por correo o el parser no lo detecta con confianza, hay una opción manual directa en el dashboard: "marcar cuota como pagada" (ver mockup, sección Cuotas activas) — no depende 100% de la detección automática.

**Fecha de pago / vencimiento de tarjeta.** Se guarda la fecha de vencimiento por tarjeta (extraída del correo del estado de cuenta, o ingresada manualmente si no llega por correo). Hoy solo se muestra en el dashboard (sección Deudas); es el dato base para la alerta de WhatsApp de Fase 2/3 ("tu tarjeta vence en 3 días").

### 8. Detección de suscripciones (recurrencia) — sugerencia, no auto-categorización
No es 100% manual, pero tampoco se auto-asigna sin decir nada: se detecta cuando un mismo comercio + monto se repite ~mensualmente (extensión natural de las reglas de la Capa 1, pura lógica de recurrencia — no necesita IA). La categoría resultante ("Suscripciones" o "Servicios" — un cargo recurrente como iCloud de Apple puede ser cualquiera de las dos, decide el usuario) se muestra como **sugerida**, no confirmada, y solo en las transacciones que el detector marcó como candidatas — no aparece en todos lados.

Para que esto no complique el modelo de datos, no hay una entidad nueva de "suscripción": es el mismo campo de categoría que ya existe en cada transacción, con un booleano adicional `categoria_confirmada`. Una transacción categorizada por regla directa (Capa 1) nace confirmada; una categorizada por el detector de recurrencia nace como sugerida (pill con borde punteado en el dashboard en vez de relleno sólido — ver mockup). Tocarla abre el mismo selector de categoría que ya existe para cualquier transacción (no es un flujo aparte), con Suscripciones/Servicios como primeras opciones. Al confirmar (así sea la misma sugerida), pasa a `categoria_confirmada = true` y no se vuelve a preguntar para ese comercio+monto.

### 9. Cuentas conectadas — qué significa realmente
No hay una integración bancaria en vivo (no existe open banking accesible para BCP/Interbank/Pichincha). El "saldo" de cada cuenta se reconstruye: se ingresa un saldo inicial una vez, y desde ahí el sistema lo actualiza solo sumando/restando cada transacción que el parser detecta en los correos. Es un cálculo derivado, no un pull en tiempo real del banco — vale la pena que esto sea explícito en el dashboard (ej. "sincronizado hace X" ya lo comunica, pero no debe sugerir una conexión bancaria que no existe).

Cada cuenta puede tener una **billetera vinculada** (Yape/Plin — un campo opcional `billetera` en la cuenta, no una integración nueva). Es solo un tag informativo para que identifiques rápido "esta es la cuenta de mi Yape/Plin" — el saldo sigue siendo el de la cuenta bancaria subyacente, Yape/Plin no tienen su propia fuente de datos aparte.

### 10. Servicios cuasi-fijos y sobrante automático a ahorro
Servicios (agua, luz, internet) y a veces gasolina no son un monto fijo exacto mes a mes, pero sí son recurrentes — funcionan distinto a una suscripción (monto fijo) y distinto a un gasto libre (variable de verdad). Para estos:
- El presupuesto de la categoría se calcula como **promedio móvil de los últimos N meses** (ej. 3-6 meses), no un número fijo que el usuario tipea a ciegas — así "cuánto debo apartar" tiene una base real.
- **Regla de sobrante**: si el gasto real del mes en una categoría con presupuesto fijo queda por debajo de lo apartado, la diferencia se **sugiere** (no se mueve sola, mismo patrón que la detección de suscripciones) como aporte extra a la meta de ahorro — ej. "Te sobraron S/ 50 de Servicios este mes, ¿los mandamos a tu fondo de emergencia?". Aplica la misma lógica de "Pagarte a ti primero" y Ley de Parkinson ya definidas en Fundamentos, llevada a una acción concreta en vez de quedar solo como principio.
- Esto depende de que el motor de categorización y el histórico de varios meses ya existan — es Fase 2 (no bloquea el MVP), pero se documenta ahora para que el modelo de categorías (con `promedio_movil` y `sugerencia_ahorro`) se diseñe pensando en esto desde Fase 0.

### 11. Motor de insights (las 4 tarjetas de "Atención / Buena señal / Proyección / Gasto hormiga")
No son 4 tarjetas fijas ni las escribe Claude en el momento — son la salida de un **catálogo de reglas** (más de 4), cada una con su propia condición de disparo, evaluado contra tus datos reales cada vez que abres el dashboard:
- Ej. "Atención" dispara si `gasto_categoria > presupuesto AND variación_mensual > umbral`.
- Ej. "Proyección de fondo de emergencia" dispara mientras `fondo_actual < meta`; deja de disparar solo cuando se completa la meta.
- Ej. "Gasto hormiga" es casi siempre visible (es un cálculo recurrente, no una condición binaria).

Cuando una regla deja de cumplirse (ej. ya llenaste el fondo de emergencia), esa tarjeta desaparece y se muestra la siguiente regla del catálogo que sí aplique ese mes — con un mensaje de respaldo genérico si ninguna regla dispara. Por eso el catálogo debe tener más de 4 reglas candidatas desde el diseño, no exactamente 4 fijas. No requiere IA — es lógica de negocio sobre datos ya categorizados (misma idea que "Psychology of Money": nudges de comportamiento, no solo números estáticos).

### 12. Presupuesto por categoría — orden por urgencia
La lista de categorías (en Presupuesto y en el resumen "Categorías a vigilar" de Inicio) se ordena por qué tan cerca o pasada está del límite (% usado descendente), no alfabética ni por monto. Las categorías sin movimiento van al final. Inicio solo muestra el top 2-3 de esa misma lista ordenada — no es una lista aparte, es un slice del mismo cálculo.

## Frontend y navegación
El dashboard deja de ser una sola página larga una vez que existe historial real e "insights" que se comportan como alertas. Navegación tipo **tab bar** inferior (mobile) con 4 secciones — ya maquetadas y navegables en el mockup.

**Principio de diseño: Inicio es de solo lectura; cada pestaña adicional es una superficie de gestión de su dominio, no un espejo de Inicio.** Agregar/editar/eliminar nunca vive en Inicio — vive en la pestaña del dominio correspondiente:

- **Inicio**: el resumen/digest — hero de disponible real, patrimonio con rango interactivo, insights (icono + número + texto, corto en mobile y completo en desktop, ver §11), stats del mes, chips de "compromisos recurrentes" con ícono (suscripciones, cuotas activas, deuda pendiente — antes invisibles en Inicio, ahora se ven de un vistazo y enlazan a su pestaña), donut de categorías, "categorías a vigilar" (top 2-3 más urgentes, ver §12), plan de gasto consciente condensado, teaser de cuentas y de los últimos movimientos con enlaces "ver más" hacia las otras pestañas. Se recalcula cada vez que se abre — no depende de notificaciones push del navegador (frágiles en iOS salvo instalado como PWA). Sin botones de agregar/editar.
- **Movimientos**: gestión de transacciones — historial completo del mes agrupado por día, filtro por categoría, y **"+ Agregar gasto manual" vive acá** (no en Inicio). Pendiente (no bloqueante): paginar el historial — hoy carga todo el mes de golpe, que con suficiente volumen de transacciones es mal rendimiento.
- **Presupuesto**: gestión del plan de gasto — plan de gasto consciente completo (con "editar metas"), presupuesto por categoría con límite editable por categoría, gasto hormiga anualizado, suscripciones (editables/cancelables) y cuotas activas.
- **Cuentas**: gestión del balance — cuentas conectadas (editables), alta de cuenta manual, fondo de emergencia (con "editar meta"), y deudas (editables, con alta de nueva deuda).

Las alertas *proactivas* de verdad (que te avisan sin que abras el dashboard) siguen siendo trabajo de WhatsApp (fase 2/3), no de push notifications del navegador.

El detalle sección por sección (qué datos, qué acciones, con qué prioridad se construye cada una) está en `especificacion-pantallas.md`.

## Fundamentos de finanzas personales aplicados al producto
Principios de autores/libros reconocidos, traducidos a features concretas — insumo para el alcance técnico, no solo referencia teórica.

- **Pagarte a ti primero, automatizado** (*The Richest Man in Babylon*, Clason; *The Automatic Millionaire*, David Bach): al detectar el ingreso mensual, calcular y marcar cuánto debería apartarse ese mismo día (ahorro/inversión), no al final del mes.
- **Ley de Parkinson del gasto**: separar "saldo bruto" de "disponible real" (bruto menos lo ya comprometido a fijos, ahorro y metas) — más importante que cualquier gráfico.
- **Cada sol con un trabajo asignado** (YNAB, Jesse Mecham): refuerza el plan de gasto consciente ya definido.
- **Gasto hormiga anualizado** ("Latte factor", David Bach): en gastos recurrentes chicos, mostrar también el total anual, no solo el mensual.
- **El comportamiento pesa más que el conocimiento técnico** (*The Psychology of Money*, Morgan Housel): nudges de comportamiento (ej. "llevas 3 semanas gastando más en delivery que el mes anterior"), no solo números estáticos.
- **Fondo de emergencia y deuda de consumo antes que invertir agresivo** (*The Total Money Makeover*, Dave Ramsey): módulo de deudas con método snowball/avalanche, activable solo si aplica.
- **Tasa de ahorro por encima de todo** (*The Simple Path to Wealth*, JL Collins): mostrar tendencia histórica de la tasa de ahorro, no solo el mes actual.
- **El ritual de revisión, no solo el dashboard** (concepto del "money date", Ramit Sethi): la revisión semanal/mensual como hábito dentro de Learning OS; el bot de WhatsApp (fase 3) encaja como recordatorio de este ritual, además de notificación de compra.
- **Costo en horas de vida** (*Your Money or Your Life*, Robin & Dominguez): en compras grandes, mostrar el equivalente en horas de trabajo (feature de más adelante, no urgente).

**Conexión con el resto de Growth OS**: cuando la tasa de ahorro/inversión genera excedente sostenido, esa señal alimenta a Opportunity Radar ("tienes S/X disponibles de forma constante, esto es lo que podrías evaluar invertir") — Wealth OS deja de ser solo registro y empieza a alimentar al resto del sistema.

## Backlog operativo — pendientes reportados (2026-09-17)

Puntos reportados en revisión de uso real de la app (no del mockup). Verificados contra el código antes de anotarlos, para no listar como "pendiente" algo que ya funciona.

### Bugs confirmados (corregir)
- [x] **La hora de la transacción se resetea a 00:00 al editar.** ✅ Implementado — `movimientos/actions.ts` preserva la hora original de `transaccion.fecha` cuando la fecha (día) no cambió.
- [x] **Marcar una cuota como "pagada" no la descuenta de "Disponible real hoy" del mes.** ✅ Rediseñado por completo — ver "Cuotas: rediseño a registro mensual" más abajo.

### Nuevas funcionalidades
- [x] **"Sin contabilizar" por movimiento individual.** ✅ Implementado (`transacciones.excluida`) — se gestiona desde un picker rápido por fila en Movimientos (botón "+ etiqueta"), no desde el form completo.
- [x] **Resumen por categoría + etiqueta/subcategoría.** ✅ Implementado junto con el sistema de tags (Fase D) — expandible en "Presupuesto por categoría".
- [x] **Paginación de Movimientos.** ✅ Implementado — `transaccionesDelMes()` acepta `limit`/`offset`, botón "Cargar más" en `MovimientosView.tsx`.
- [x] **2 reglas nuevas en el motor de insights: "Proyección" y "Gasto hormiga".** ✅ Cableadas al catálogo de `src/logic/insights.ts`.

### Gaps de onboarding
- [x] **"Categorías a vigilar" sin barra/consumido-total cuando no hay límite.** ✅ Implementada la opción (b): CTA "Configura un límite →" en `page.tsx` cuando `limiteMensual` es `null`. El límite sugerido automático (promedio móvil, §10) se descartó, sigue como posible mejora futura si el CTA no alcanza.

### Ya funciona correctamente (aclaraciones, sin acción pendiente)
- **La barra de progreso por categoría YA es progresiva en todo momento cuando hay límite configurado** (verde → ámbar ≥80% → rojo ≥100%), tanto en "Categorías a vigilar" de Inicio (`src/app/page.tsx:67-72`) como en "Presupuesto por categoría" (`PresupuestoView.tsx:16-21`). El gap real no es la lógica de la barra sino la falta de límites configurados de entrada — ver el punto de onboarding arriba.
- **El motor de insights no es estático ni depende de IA en tiempo real.** Es lógica de negocio pura sobre datos ya categorizados, se recalcula en cada carga de Inicio (barato, instantáneo) — no hace falta un botón de "recargar" ni un cron semanal para esto. La confusión de "actualizar cada semana" aplicaría solo si en algún momento se usara IA generativa para redactar los insights, que no es el caso hoy ni el plan.
- **"Tu mes en números": los 4 stats y sus mensajes de comparación YA existen y funcionan** (`src/app/page.tsx:254-275`, lógica de deltas en `src/logic/comparaciones.ts`, ej. "+ S/ 300 vs. agosto"). Solo falta el título de sección arriba de las tarjetas — hoy no hay un `<div className="stats-label">Tu mes en números</div>` antes del grid, a diferencia de "Compromisos recurrentes" que sí lo tiene. Es un cambio de una línea, no una feature nueva.

### Features grandes — todas implementadas (Fases A-E, sesión 2026-09-16 al 2026-09-18)

**Fase A — Quick wins.** ✅ Ver checklist arriba (bugs + gaps de onboarding).

**Fase B — Persistencia de reglas de categorización.** ✅ Tabla `reglas_categorizacion` (patrón, categoría, origen manual/IA, `vecesUsada`). `procesarCorreo()` (`src/gmail/procesar.ts`) ahora prueba: tipo → BD (`buscarReglaPorComercio`) → array hardcodeado (`reglas.ts`, queda como semilla) → Capa 2 IA. `actualizarTransaccion`/`crearTransaccion` guardan/actualizan la regla automáticamente al confirmar una categoría.

**Fase C — Tab de Configuración.** ✅ `/configuracion`: CRUD de categorías (crear/editar/archivar — nunca delete duro, por el historial), en layout de 2 columnas: col-main = Categorías + Etiquetas, col-side = "Categorización automática" (toggles funcionales, no decorativos: **"Sugerir con IA"** apaga la Capa 2 en `procesarCorreo()`, **"Aprender reglas nuevas"** apaga el guardado automático de reglas — tabla `configuracion_ia`, fila única) + lista de Reglas de categorización (patrón truncado visualmente a 220px con `title` para ver el completo al hover).

**Fase D — Sistema de etiquetas (tags).** ✅ Tags planos, muchos-a-muchos (tabla `tags` + puente `transacciones_tags`). Picker rápido por fila en Movimientos (botón "+ etiqueta" → modal con pills toggleables + el checkbox de "sin contabilizar", sin pasar por el form grande). Drill-down por categoría+etiqueta en Presupuesto.

**Fase E — Metas de compra.** ✅ `/presupuesto`, sub-sección "Metas de compra". Cada meta crea su propia categoría dedicada (bucket `ahorro`) — el progreso se deriva de movimientos reales en esa categoría (mismo principio que `fondoEmergencia`), no de un número manual. Método "cuotas" se puede vincular a una compra real de `comprasCuotas` una vez concretada. Sugerencia de cuánto apartar por mes es matemática simple (falta / meses restantes) — **no usa IA todavía**, a diferencia de lo que planteaba el diseño original (queda como posible mejora, ver pendientes abajo).

### Cuotas: rediseño a registro mensual (post Fase A, durante correcciones de la sesión)
El modelo viejo (`cuotasPagadas` como contador de por vida + `ultimoPagoMes` como string único) no permitía ver ni corregir el estado mes a mes. Se agregó `pagos_cuota` (tabla append-only: una fila por `compraCuotaId` + mes realmente pagado). `cuotasPagadas` de `compras_cuotas` pasó a ser solo la *base* (pagos previos a este rediseño, congelada) — el total real es `base + COUNT(pagos_cuota)`. Una cuota ya no desaparece de "Cuotas activas" al marcarla pagada: se queda visible con el label **"[Mes]: Pagada/Pendiente"** y un botón para deshacer. También se agregó un editor manual (✎) para corregir el total de cuotas pagadas si el conteo queda mal (ajusta la base, sin tocar el registro mensual ya cargado).

### Correcciones de datos reales encontradas durante la sesión (no son bugs de código)
- Reconciliado saldo de una cuenta BCP: el hueco venía de una transferencia real (de un familiar) que nunca llegó por correo — se cargó a mano como ingreso manual. El parser de Gmail puede estar perdiendo cierto formato de correo de transferencias recibidas; no se investigó la causa raíz.
- Corregidos los contadores base de 2 compras en cuotas que habían quedado mal seedeadas (Gimnasio B2 tenía 2/6 en vez de 0/6; Mantenimiento de carro tenía 5/6 + un pago de más marcado en vez de 4/6 real).

### Pendientes reales — nada bloqueante, quedan para cuando se retome

1. **Vincular automáticamente "pago a mi propia tarjeta" con la deuda de esa tarjeta.** Hoy, cuando el usuario paga su propia tarjeta de crédito vía una transferencia que sale de una cuenta líquida, `pareceNombrePropio()` (`src/logic/transferencia-interna.ts`) la marca `esTransferenciaInterna=true` correctamente, pero **nunca se intenta resolver un `cuentaDestinoId` hacia la tarjeta** — esa resolución (`resolverCuentaIdPorDigitos` + `extraerDigitosDestino`) solo se dispara en `procesar.ts` cuando el banco YA marcó el correo como transferencia (`parsed.esTransferenciaInterna`), no cuando lo detecta la heurística de nombre propio después. Efecto: la deuda de la tarjeta (`deudaPendiente()`) no baja aunque el usuario haya pagado, hasta que se corrija a mano con el editor ✎ de Deudas (ya existe como parche manual). **Antes de programar el arreglo automático, falta confirmar con el usuario a qué tarjeta van exactamente esos pagos** (se sospecha que "IO*ISAI ENRIQUE BRAVO S" es la Tarjeta IO BCP, pero no se confirmó) — no implementar a ciegas.
2. **¿La IA puede proponer categorías nuevas?** Hoy `categorizarConIA()` (`src/categorizacion/ia.ts`) está limitada por diseño a un enum de las categorías ya existentes (para que nunca cree una categoría sin que el usuario la revise). Sigue siendo una decisión abierta si en algún momento se quiere que la IA sugiera "esto podría ser una categoría nueva" en vez de forzarla a elegir entre las que ya hay.
3. **Detección automática de suscripciones por recurrencia (roadmap §8) — todavía no implementada.** El widget "Suscripciones" de Presupuesto/Inicio hoy es 100% manual (categoría o etiqueta "Suscripciones" puesta a mano) — funciona y ya está conectado en Inicio, pero no detecta solo cuando un comercio+monto se repite ~mensualmente como proponía el diseño original.
4. **Límite sugerido automático por promedio móvil (roadmap §10)** para categorías sin límite configurado — descartado a propósito en Fase A a favor del CTA manual "Configura un límite →". Revisar si hace falta más adelante.
5. **Sugerencia de aporte mensual para metas de compra vía IA** — hoy es matemática simple (falta/meses restantes), el diseño original de la Fase E planteaba usar Claude para sugerir el monto considerando el gasto libre disponible y competencia entre metas. No implementado.
6. **Parsers de Interbank y Pichincha** — el roadmap (Fase 0) los marca como prioridad pendiente; no se tocó código de parsers en esta sesión, su estado real no fue verificado.
7. **Fase 2/3 del roadmap (notificaciones/bot de WhatsApp)** — no iniciado, confirmado como low priority.

## Fases

**Fase 0 — Consolidar lo existente**
Migrar ya de Sheets a Turso (decidido). Prioridad de parsers: Interbank primero (uso más frecuente); Pichincha después si es rápido — ahí prácticamente todo son transferencias, así que el parser puede ser más simple (no necesita tanta lógica de categorización de compras).

**Fase 1 — Automatización real (sin ti, sin Claude)**
Cron/webhook + parsers + dedupe + detección de transferencias + escritura directa a la base. Dashboard se actualiza solo. Este es el hito que resuelve tu pregunta central.

**Fase 2 — WhatsApp como notificación (solo salida)**
Después de cada transacción parseada, un mensaje de WhatsApp con el detalle. Es redundante con lo que ya tienes (correo + dashboard), pero es la base técnica para la fase 3. También el lugar natural para la alerta de vencimiento de tarjeta de crédito (ver §7) — es la misma infraestructura de notificación saliente, no un canal nuevo. Opciones:
- **Meta WhatsApp Cloud API** (oficial, directo): gratis hasta cierto volumen, pero requiere verificación de negocio con Meta.
- **Twilio WhatsApp API**: integración más rápida, de pago por mensaje, sin trámite de verificación tan pesado.

**Fase 3 — WhatsApp interactivo**
Botones de respuesta rápida para confirmar/corregir categoría, monto o si es transferencia — la corrección se escribe de vuelta a la base. Aquí es donde WhatsApp deja de ser cosmético y empieza a mejorar la calidad del dato.

**Fase 4 — Productización**
Solo si Fase 1–3 funcionan bien para ti: multi-tenant (cada usuario conecta su propio Gmail vía OAuth), sistema de parsers como catálogo de bancos soportados, panel de administración, facturación. El enfoque de venta probablemente cambia según a quién le apuntes (freelancers/personas vs. pequeños negocios) — eso se define después de validar contigo mismo.

## Decisiones confirmadas
- Se separa como proyecto propio (no dentro de Growth OS). Cuando el plan comercial a futuro esté definido, se arma un markdown aparte con ese detalle para dárselo a Claude Code como brief inicial.
- Migración a Turso desde ya, sin fase intermedia en Sheets.
- WhatsApp: se elige la opción más rápida, simple y barata (probablemente Twilio, por menor trámite de arranque frente a la verificación de negocio de Meta) — queda como low priority, no es foco en las primeras fases.
- El sistema de categorías y reglas no cambia en esencia respecto a lo pensado antes — la diferencia real es que el registro pasa a ser automático en vez de manual. Se mantiene la posibilidad de agregar gastos a mano cuando haga falta (efectivo, algo que no llega por correo, etc.).

## Mockups
Mockup mobile-first completo: `dashboard-mockup-v2.html` (publicado como artifact). Las 4 pestañas (Inicio, Movimientos, Presupuesto, Cuentas) ya son navegables dentro del mismo archivo — la tab bar inferior cambia de pantalla de verdad, no es solo decorativa. Cada pestaña adicional ya muestra sus acciones de gestión (agregar/editar), y Presupuesto/Cuentas/Movimientos tienen su propio layout de 2 columnas en desktop (no son solo la versión mobile ampliada). Esto ya refleja la arquitectura de información con la que se picaría código, para minimizar cambios de diseño una vez en desarrollo — el detalle pantalla por pantalla está en `especificacion-pantallas.md`.

## Plan técnico y costos
Ver `plan-tecnico-mvp.md` para el alcance técnico detallado de Fase 0-1 y el estimado de costos (Claude API, hosting, storage, WhatsApp).
