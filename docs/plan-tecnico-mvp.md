# Wealth OS — Plan técnico y costos (MVP: Fase 0-1)

Alcance técnico concreto para pasar del Sheets manual actual a "corre solo, siempre", con estimado de costos real. Complementa `roadmap-finanzas-automaticas.md` (ahí está el porqué de cada decisión; acá está el cómo y el cuánto).

## 1. Stack

| Pieza | Elección | Por qué |
|---|---|---|
| Dashboard | Next.js (el que ya existe en Growth OS) | No hay que levantar nada nuevo, solo nuevas rutas y componentes |
| Base de datos | Turso (libSQL/SQLite) + Drizzle ORM | Ya decidido en el roadmap; gratis a la escala de un usuario personal |
| Hosting | Vercel (plan Hobby, gratis) | Ya es donde probablemente vive el Next.js |
| Disparador | Gmail API `watch()` + Google Cloud Pub/Sub (webhook) | Ver §2 — reemplaza al polling con cron |
| Categorización fallback | Claude API, modelo Haiku 4.5 | Clasificación de texto corto, no necesita un modelo caro |
| WhatsApp (fase 2/3, no MVP) | Twilio o Meta Cloud API | Ver §4 — no es parte del costo del MVP |

## 2. Por qué Gmail Push y no polling

El roadmap original dejaba abierta la opción de arrancar con polling (cron cada 5-10 min) y migrar después a Gmail Push. Al revisar los límites reales de Vercel Hobby (plan gratuito) esto cambia:

- **Vercel Hobby limita el cron a una vez al día.** Cualquier expresión más frecuente falla al desplegar ("Hobby accounts are limited to daily cron jobs"). Para un polling de 5-10 min habría que pasar a Vercel Pro (US$20/mes).
- **Gmail Push solo necesita un cron de renovación semanal** (el `watch()` de Gmail expira cada 7 días) — eso sí cabe sin problema en el límite diario de Hobby.
- Bonus: Gmail Push da latencia real (te enteras apenas llega el correo) en vez de esperar el próximo ciclo de polling.

**Conclusión: se salta el polling por completo y se va directo a Gmail Push + Pub/Sub.** Esto simplifica el roadmap (una opción menos que construir y luego migrar) y además es la opción gratuita.

## 3. Alcance funcional del MVP (Fase 0-1)

- Migración Sheets → Turso.
- Parsers plug-in: BCP (listo), Interbank (prioridad), Pichincha (después, es simple porque son casi todo transferencias).
- Deduplicación por número de operación.
- Motor de transferencias internas (mismo monto, fecha/hora cercana, cuenta propia → cuenta propia).
- Categorización: reglas por comercio (Capa 1) + Claude Haiku como fallback (Capa 2).
- Detección de cuotas ("cuota X/Y" en el correo) — separa el compromiso total del gasto real del mes.
- Detección de recurrencia (candidatos a suscripción) con confirmación manual la primera vez.
- Saldos de cuenta reconstruidos (saldo inicial + suma de transacciones parseadas), no un pull bancario en vivo.
- Dashboard con navegación por pestañas (Inicio / Movimientos / Presupuesto / Cuentas) en vez de una sola página larga.

Explícitamente fuera del MVP: WhatsApp (fase 2/3), multi-tenant/productización (fase 4).

## 4. Costos estimados

La pieza que más dudas suele generar es la de IA, así que empiezo por ahí.

### 4.1 ¿Esto necesita IA? ¿Cuánto cuesta?

Sí, pero en un rol muy acotado: **Claude solo entra como respaldo de categorización** cuando ninguna regla de comercio matchea (Capa 2). No es un chatbot corriendo todo el tiempo — es una clasificación corta (nombre del comercio + monto → categoría) que se dispara solo para las transacciones que las reglas no reconocen.

Con el modelo recomendado, **Claude Haiku 4.5** (US$1.00 / 1M tokens de entrada, US$5.00 / 1M de salida — el más barato y más que suficiente para clasificar texto corto):

| Escenario | Transacciones/mes que caen a IA | Costo estimado/mes |
|---|---|---|
| Realista (reglas ya maduras, ~10-20% sin matchear) | ~20-30 | **~US$0.02** |
| Pesimista (recién empezando, reglas cubren poco) | ~150-200 (casi todo) | **~US$0.50-0.75** |

Incluso en el escenario pesimista, estamos hablando de **menos de US$1 al mes**. A medida que las reglas de comercio maduran (Capa 1), este costo baja solo, porque cada vez menos transacciones necesitan pasar por Claude.

### 4.2 El resto de la infraestructura

| Servicio | Uso | Costo |
|---|---|---|
| Vercel Hobby | Hosting del dashboard + webhook + cron semanal de renovación | **US$0** |
| Turso (free tier) | 5GB de storage, 500M lecturas/mes, 10M escrituras/mes | **US$0** — a años luz del volumen de un usuario personal |
| Gmail API | `watch()` + lectura de correos | **US$0** |
| Google Cloud Pub/Sub | Entrega del webhook de Gmail Push | **US$0** — el free tier (10GB/mes) no se acerca a rozarse con este volumen |
| Dominio (opcional) | Solo si se productiza (fase 4) | ~US$10-15/año |

### 4.3 Total del MVP (Fase 0-1)

**Menos de US$1 al mes**, prácticamente todo concentrado en el fallback de categorización con Claude. Todo lo demás corre en capas gratuitas con margen de sobra para uso personal.

### 4.4 Si más adelante se activa WhatsApp (Fase 2/3 — no es parte del MVP)

Dos caminos, con números reales (no aproximaciones de memoria):

- **Meta WhatsApp Cloud API**: 1,000 conversaciones de servicio gratis al mes por número de teléfono. Para uso personal (notificarte tus propias transacciones) probablemente nunca superas ese límite → **efectivamente US$0/mes**, pero requiere verificación de negocio con Meta antes de poder usarlo (trámite, no dinero).
- **Twilio**: US$0.005 por mensaje (fee de Twilio) + la tarifa de Meta por conversación según categoría/país (del orden de US$0.03-0.06 en la región). Para un volumen personal (unas pocas decenas de mensajes/mes) esto queda en **~US$1-3/mes**. Arranque más rápido, sin el trámite de verificación de Meta.

Dado que es low priority según el roadmap, no hace falta decidir esto ahora — ambas opciones son baratas a este volumen; la diferencia real es trámite vs. costo marginal.

## 5. Riesgos / decisiones pendientes

- **Interbank y Pichincha**: falta mapear remitente y formato de correo antes de poder escribir esos parsers — es el primer bloqueador real de Fase 0.
- **Google Cloud project**: Gmail Push requiere crear un proyecto de GCP y configurar Pub/Sub — es infraestructura nueva (gratis, pero hay que montarla), a diferencia de lo que sugería la opción de polling.
- **Detección de recurrencia (suscripciones)**: el umbral para "esto parece una suscripción" (¿2 meses seguidos? ¿3?) se afina con datos reales una vez que haya historial.

## 6. Siguiente paso sugerido

Con esto ya se puede armar el primer brief técnico para empezar a picar código: Fase 0 (migración a Turso + parser de Interbank) es el punto de partida natural, ya que Interbank es el uso más frecuente y hoy no hay nada automatizado ahí todavía.
