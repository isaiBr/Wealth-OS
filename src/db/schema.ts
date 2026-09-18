import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// --- Cuentas -----------------------------------------------------------
// Saldo reconstruido: saldo_inicial + suma de transacciones parseadas.
// No hay pull bancario en vivo (ver roadmap §9).
export const cuentas = sqliteTable("cuentas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull(),
  banco: text("banco").notNull(), // 'interbank' | 'bcp' | 'pichincha' | ...
  alias: text("alias"),
  tipo: text("tipo").notNull(), // 'ahorro' | 'corriente' | 'tarjeta_credito'
  billetera: text("billetera"), // 'yape' | 'plin' | null — solo un tag informativo
  saldoInicial: real("saldo_inicial").notNull().default(0),
  // Controla si aparece en el resumen de Inicio (solo lectura) — Inicio no
  // debe mostrar las 8 cuentas si el usuario solo usa 2-3 en el día a día.
  // La lista completa de todas formas vive en la pestaña Cuentas.
  destacada: integer("destacada", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// --- Identificadores de cuenta ---------------------------------------------
// Resuelve "estos 4 dígitos que vienen en el correo" -> cuenta real. Separado
// de `cuentas` porque una misma cuenta puede tener más de un identificador:
// los últimos 4 dígitos de la cuenta (usados en correos de transferencia) Y
// los últimos 4 dígitos de una tarjeta ligada a ella (usados en correos de
// consumo) — son cadenas distintas apuntando al mismo lugar. Reemplaza el
// mapeo que antes vivía hardcodeado en scripts/rebuild-cuentas-bcp.ts, para
// que el webhook de Gmail en vivo (Fase 1) pueda resolver la cuenta sin
// depender de ese script.
export const identificadoresCuenta = sqliteTable(
  "identificadores_cuenta",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cuentaId: integer("cuenta_id").references(() => cuentas.id).notNull(),
    ultimosDigitos: text("ultimos_digitos").notNull(),
    createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  },
  (table) => [uniqueIndex("identificadores_cuenta_digitos_idx").on(table.ultimosDigitos)]
);

// --- Categorías ----------------------------------------------------------
export const categorias = sqliteTable("categorias", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull().unique(),
  bucket: text("bucket").notNull(), // 'fijos' | 'inversion' | 'ahorro' | 'libre'
  limiteMensual: real("limite_mensual"),
  usaPromedioMovil: integer("usa_promedio_movil", { mode: "boolean" }).notNull().default(false),
  // Para dinero que sale de tus cuentas pero no es "tu" gasto real (alguien
  // más te lo paga/devuelve fuera de la app, plata que solo pasó por ti,
  // pruebas). Se sigue viendo en Movimientos y en el saldo de la cuenta
  // (la plata sí salió), pero se excluye de los totales de gasto real
  // (resumen del mes, presupuesto por categoría, gasto hormiga).
  excluirDeGastoReal: integer("excluir_de_gasto_real", { mode: "boolean" }).notNull().default(false),
  // Ocultarla de los selectores de categoría (Movimientos) sin borrarla ni
  // tocar los movimientos históricos que ya la tienen asignada.
  archivada: integer("archivada", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// --- Reglas de categorización aprendidas ------------------------------------
// Reemplaza gradualmente el array hardcodeado de src/categorizacion/reglas.ts.
// `patron` se guarda siempre normalizado (comercio.trim().toUpperCase()) y se
// matchea por igualdad exacta contra el comercio normalizado de cada
// transacción nueva — sin regex, sin heurísticas de extracción de texto.
export const reglasCategorizacion = sqliteTable(
  "reglas_categorizacion",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    patron: text("patron").notNull(),
    categoriaId: integer("categoria_id").references(() => categorias.id).notNull(),
    origen: text("origen").notNull(), // 'manual' | 'ia'
    vecesUsada: integer("veces_usada").notNull().default(1),
    createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  },
  (table) => [uniqueIndex("reglas_categorizacion_patron_idx").on(table.patron)]
);

// --- Tarjetas de crédito ---------------------------------------------------
// Necesaria para: (a) rastrear cuotas activas por tarjeta, (b) fecha de
// vencimiento para la futura alerta de WhatsApp, (c) matchear el correo
// "pago de tarjeta de crédito" con la tarjeta correcta (ver roadmap §7).
export const tarjetas = sqliteTable("tarjetas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cuentaId: integer("cuenta_id").references(() => cuentas.id),
  nombre: text("nombre").notNull(), // ej. "Interbank Visa Signature"
  banco: text("banco").notNull(),
  fechaVencimiento: text("fecha_vencimiento"), // próxima fecha de pago del estado de cuenta
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// --- Transacciones ---------------------------------------------------------
export const transacciones = sqliteTable(
  "transacciones",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cuentaId: integer("cuenta_id").references(() => cuentas.id).notNull(),
    tipo: text("tipo").notNull(),
    // 'compra' | 'transferencia' | 'retiro' | 'pago_servicio'
    // | 'pago_tarjeta_credito' | 'ingreso'
    monto: real("monto").notNull(),
    moneda: text("moneda").notNull().default("PEN"),
    comercio: text("comercio"),
    descripcion: text("descripcion"),
    fecha: text("fecha").notNull(), // ISO 8601
    numeroOperacion: text("numero_operacion"), // dedupe — único junto con tipo (ver índice abajo)
    categoriaId: integer("categoria_id").references(() => categorias.id),
    categoriaConfirmada: integer("categoria_confirmada", { mode: "boolean" })
      .notNull()
      .default(false),
    esTransferenciaInterna: integer("es_transferencia_interna", { mode: "boolean" })
      .notNull()
      .default(false),
    cuentaDestinoId: integer("cuenta_destino_id").references(() => cuentas.id),
    // Transacción marcada como "sin contabilizar" — excluida de totales de gasto/ingreso
    // pero sigue visible en Movimientos y contando en saldos de cuenta
    excluida: integer("excluida", { mode: "boolean" }).notNull().default(false),
    fuente: text("fuente").notNull(), // 'email' | 'manual'
    correoRaw: text("correo_raw"), // cuerpo original, para depurar el parser
    // Dedupe real para correos que no traen número de operación (ej. los
    // "consumo con tarjeta" de Interbank) — sin esto, cada reprocesamiento
    // del mismo mensaje (reintento del webhook, backfill manual) insertaba
    // un duplicado. Null para las transacciones que no vinieron de un
    // mensaje de Gmail real (carga histórica, manuales).
    gmailMessageId: text("gmail_message_id"),
    createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  },
  (table) => [
    // BCP reutiliza el mismo número de operación para una compra Y su
    // devolución (son el mismo "evento" visto dos veces) — el dedupe real
    // es por (número de operación + tipo), no por número de operación solo.
    uniqueIndex("transacciones_numero_operacion_tipo_idx").on(table.numeroOperacion, table.tipo),
    uniqueIndex("transacciones_gmail_message_id_idx").on(table.gmailMessageId),
  ]
);

// --- Etiquetas ---------------------------------------------------------
// Detalle fino dentro de una categoría (a diferencia de `categorias`, un
// movimiento puede tener varias a la vez — ver plan de la sesión: tags
// planos, muchos-a-muchos, no subcategorías anidadas).
export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull().unique(),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// Tabla puente: una fila por (transacción, tag) asignado.
export const transaccionesTags = sqliteTable(
  "transacciones_tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    transaccionId: integer("transaccion_id")
      .references(() => transacciones.id, { onDelete: "cascade" })
      .notNull(),
    tagId: integer("tag_id").references(() => tags.id, { onDelete: "cascade" }).notNull(),
  },
  (table) => [uniqueIndex("transacciones_tags_par_idx").on(table.transaccionId, table.tagId)]
);

// --- Compras en cuotas -------------------------------------------------
// Una fila por compra a plazos (no una por mes). `cuotasPagadas` ahora es
// solo la BASE: pagos que ya existían antes de que existiera el registro
// mensual (`pagosCuota` abajo) — no se sigue incrementando. De acá en
// adelante cada pago mensual real es su propia fila en `pagosCuota`, así se
// puede ver/agregar/quitar el pago de un mes puntual (ej. "Setiembre:
// pagada") en vez de un solo contador de por vida sin historial.
export const comprasCuotas = sqliteTable("compras_cuotas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tarjetaId: integer("tarjeta_id").references(() => tarjetas.id).notNull(),
  transaccionOrigenId: integer("transaccion_origen_id").references(() => transacciones.id),
  comercio: text("comercio").notNull(),
  montoTotal: real("monto_total").notNull(),
  montoCuota: real("monto_cuota").notNull(),
  totalCuotas: integer("total_cuotas").notNull(),
  cuotasPagadas: integer("cuotas_pagadas").notNull().default(0),
  fechaCompra: text("fecha_compra").notNull(),
  // Campo viejo, ya no se escribe (reemplazado por pagosCuota) — se deja sin
  // borrar para no perder el dato histórico que ya tenía.
  ultimoPagoMes: text("ultimo_pago_mes"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// Un pago mensual real de una cuota — registro append-only (nunca se
// sobreescribe, se agrega o se borra una fila puntual). `cuotasPagadas` de
// arriba + COUNT(pagosCuota de esa compra) = total de cuotas pagadas.
export const pagosCuota = sqliteTable(
  "pagos_cuota",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    compraCuotaId: integer("compra_cuota_id").references(() => comprasCuotas.id).notNull(),
    mes: text("mes").notNull(), // "YYYY-MM"
    createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  },
  (table) => [uniqueIndex("pagos_cuota_compra_mes_idx").on(table.compraCuotaId, table.mes)]
);

// --- Metas de compra --------------------------------------------------------
// Presupuesto para algo puntual que querés comprar (no un gasto recurrente).
// Mismo principio que fondoEmergencia: el progreso NO se guarda como un
// número aparte que se pueda desincronizar — se deriva en vivo de una
// categoría dedicada (categoriaId, bucket 'ahorro', autogenerada al crear la
// meta). Aportar a la meta es simplemente registrar un movimiento con esa
// categoría, igual que cualquier otro gasto/ahorro de la app.
export const metasCompra = sqliteTable("metas_compra", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull(),
  precioObjetivo: real("precio_objetivo").notNull(),
  fechaDeseada: text("fecha_deseada"), // "YYYY-MM-DD", opcional
  metodoPago: text("metodo_pago").notNull(), // 'contado' | 'cuotas' | 'cobranzas'
  categoriaId: integer("categoria_id").references(() => categorias.id).notNull(),
  // Si metodoPago='cuotas' y ya se concretó la compra, se vincula acá — el
  // progreso pasa a leerse de comprasCuotas en vez de la categoría.
  compraCuotaId: integer("compra_cuota_id").references(() => comprasCuotas.id),
  estado: text("estado").notNull().default("activa"), // 'activa' | 'completada' | 'cancelada'
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// --- Estado de sincronización de Gmail (Fase 1) ----------------------------
// Fila única (id=1) con el historyId más reciente ya procesado — el webhook
// lo usa para pedirle a la Gmail API solo lo nuevo desde la última vez
// (users.history.list), en vez de reprocesar toda la bandeja.
export const gmailSyncState = sqliteTable("gmail_sync_state", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  historyId: text("history_id").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
});

// --- Configuración de categorización automática -----------------------------
// Fila única (igual patrón que fondoEmergencia) — controla si la Capa 2 (IA)
// y el aprendizaje automático de reglas (ver reglasCategorizacion) están
// prendidos. Default true en ambas si nunca se tocó (sin fila todavía).
export const configuracionIa = sqliteTable("configuracion_ia", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sugerirConIa: integer("sugerir_con_ia", { mode: "boolean" }).notNull().default(true),
  aprenderReglasNuevas: integer("aprender_reglas_nuevas", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// --- Fondo de emergencia ----------------------------------------------------
// Fila única — el "monto actual" no se duplica acá, se lee en vivo del saldo
// de la cuenta ligada (mismo principio que el resto de la app: nada de
// saldos manuales que se puedan desincronizar).
export const fondoEmergencia = sqliteTable("fondo_emergencia", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cuentaId: integer("cuenta_id").references(() => cuentas.id).notNull(),
  metaMeses: real("meta_meses").notNull(),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// --- Cobranzas (dinero por cobrar) -----------------------------------------
// Lo inverso de una deuda: plata que te deben (préstamos hechos, ventas
// pendientes de cobrar), a mano — no llega por correo como una transacción
// bancaria, así que no vive en `transacciones`. Cuando el dinero real entra
// a una cuenta, esa transferencia la captura el webhook por su cuenta; esta
// tabla es solo el recordatorio/tracking de "me deben esto", no se cruza
// automáticamente con transacciones para evitar contarlo doble.
export const cobranzas = sqliteTable("cobranzas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  descripcion: text("descripcion").notNull(),
  montoEsperado: real("monto_esperado").notNull(),
  estado: text("estado").notNull().default("pendiente"), // 'pendiente' | 'cobrado'
  fechaCobro: text("fecha_cobro"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// --- Deudas manuales --------------------------------------------------------
// Lo inverso de cobranzas: deuda que no viene de una tarjeta de crédito
// trackeada (deudaPendiente() ya deriva esa automático del saldo de las
// cuentas tipo tarjeta_credito) — para un préstamo de un familiar/amigo,
// o cualquier otra deuda que no tenga cuenta propia en el sistema.
export const deudasManuales = sqliteTable("deudas_manuales", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  descripcion: text("descripcion").notNull(),
  montoAdeudado: real("monto_adeudado").notNull(),
  estado: text("estado").notNull().default("pendiente"), // 'pendiente' | 'pagada'
  fechaPago: text("fecha_pago"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});
