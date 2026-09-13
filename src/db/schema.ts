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

// --- Categorías ----------------------------------------------------------
export const categorias = sqliteTable("categorias", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull().unique(),
  bucket: text("bucket").notNull(), // 'fijos' | 'inversion' | 'ahorro' | 'libre'
  limiteMensual: real("limite_mensual"),
  usaPromedioMovil: integer("usa_promedio_movil", { mode: "boolean" }).notNull().default(false),
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
    createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  },
  (table) => [
    // BCP reutiliza el mismo número de operación para una compra Y su
    // devolución (son el mismo "evento" visto dos veces) — el dedupe real
    // es por (número de operación + tipo), no por número de operación solo.
    uniqueIndex("transacciones_numero_operacion_tipo_idx").on(table.numeroOperacion, table.tipo),
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
