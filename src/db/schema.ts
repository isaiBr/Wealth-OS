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
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

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

// --- Compras en cuotas -------------------------------------------------
// Una fila por compra a plazos (no una por mes) — el estado "cuántas
// cuotas van pagadas" se actualiza al detectar pago_tarjeta_credito o
// manualmente (ver roadmap §7 y especificacion-pantallas.md).
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
