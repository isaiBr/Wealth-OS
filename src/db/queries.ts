import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "./client";
import {
  categorias,
  cobranzas,
  comprasCuotas,
  configuracionIa,
  cuentas,
  deudasManuales,
  fondoEmergencia,
  metasCompra,
  pagosCuota,
  reglasCategorizacion,
  tags,
  tarjetas,
  transacciones,
  transaccionesTags,
} from "./schema";

export type Cuenta = typeof cuentas.$inferSelect;
export type Categoria = typeof categorias.$inferSelect;
export type Transaccion = typeof transacciones.$inferSelect;
export type Cobranza = typeof cobranzas.$inferSelect;
export type ReglaCategorizacion = typeof reglasCategorizacion.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type DeudaManual = typeof deudasManuales.$inferSelect;
export type MetaCompra = typeof metasCompra.$inferSelect;

export async function listarCuentas() {
  return db.select().from(cuentas).orderBy(asc(cuentas.id));
}

export async function listarCategorias() {
  return db.select().from(categorias).orderBy(asc(categorias.nombre));
}

/** Categorías marcadas `excluirDeGastoReal` (plata que salió pero no es tu gasto real — ver schema.ts). */
async function idsCategoriasExcluidas(): Promise<Set<number>> {
  const todas = await listarCategorias();
  return new Set(todas.filter((c) => c.excluirDeGastoReal).map((c) => c.id));
}

function normalizarPatron(comercio: string): string {
  return comercio.trim().toUpperCase();
}

export async function buscarReglaPorComercio(comercio: string): Promise<number | null> {
  const patron = normalizarPatron(comercio);
  const regla = await db.select().from(reglasCategorizacion).where(eq(reglasCategorizacion.patron, patron)).get();
  if (!regla) return null;
  await db
    .update(reglasCategorizacion)
    .set({ vecesUsada: regla.vecesUsada + 1 })
    .where(eq(reglasCategorizacion.id, regla.id));
  return regla.categoriaId;
}

export async function guardarOActualizarRegla(
  comercio: string,
  categoriaId: number,
  origen: "manual" | "ia"
): Promise<void> {
  const patron = normalizarPatron(comercio);
  if (!patron) return;
  const existente = await db.select().from(reglasCategorizacion).where(eq(reglasCategorizacion.patron, patron)).get();
  if (existente) {
    await db
      .update(reglasCategorizacion)
      .set({
        categoriaId,
        origen: existente.categoriaId === categoriaId ? existente.origen : "manual",
        vecesUsada: existente.vecesUsada + 1,
      })
      .where(eq(reglasCategorizacion.id, existente.id));
  } else {
    await db.insert(reglasCategorizacion).values({ patron, categoriaId, origen, vecesUsada: 1 });
  }
}

export async function listarReglasCategorizacion() {
  return db.select().from(reglasCategorizacion).orderBy(desc(reglasCategorizacion.vecesUsada));
}

export async function eliminarReglaCategorizacion(id: number): Promise<void> {
  await db.delete(reglasCategorizacion).where(eq(reglasCategorizacion.id, id));
}

export async function crearCategoria(nombre: string, bucket: string): Promise<void> {
  await db.insert(categorias).values({ nombre, bucket });
}

export async function editarCategoria(id: number, nombre: string, bucket: string): Promise<void> {
  await db.update(categorias).set({ nombre, bucket }).where(eq(categorias.id, id));
}

export async function archivarCategoria(id: number, archivada: boolean): Promise<void> {
  await db.update(categorias).set({ archivada }).where(eq(categorias.id, id));
}

export async function listarTags() {
  return db.select().from(tags).orderBy(asc(tags.nombre));
}

export async function crearTag(nombre: string): Promise<Tag> {
  const limpio = nombre.trim();
  const existente = await db.select().from(tags).where(eq(tags.nombre, limpio)).get();
  if (existente) return existente;
  const [creado] = await db.insert(tags).values({ nombre: limpio }).returning();
  return creado;
}

export async function eliminarTag(id: number): Promise<void> {
  // Se borra a mano en vez de depender del ON DELETE CASCADE declarado en el
  // schema — Turso/libSQL no garantiza que PRAGMA foreign_keys esté
  // activado en la conexión, así que no conviene confiar en el cascade.
  await db.delete(transaccionesTags).where(eq(transaccionesTags.tagId, id));
  await db.delete(tags).where(eq(tags.id, id));
}

/** Trae los tags de varias transacciones de una — evita N+1 al listar Movimientos. */
export async function tagsPorTransaccion(transaccionIds: number[]): Promise<Map<number, Tag[]>> {
  const mapa = new Map<number, Tag[]>();
  if (transaccionIds.length === 0) return mapa;
  const filas = await db
    .select({ transaccionId: transaccionesTags.transaccionId, tag: tags })
    .from(transaccionesTags)
    .innerJoin(tags, eq(transaccionesTags.tagId, tags.id))
    .where(inArray(transaccionesTags.transaccionId, transaccionIds));
  for (const fila of filas) {
    const lista = mapa.get(fila.transaccionId) ?? [];
    lista.push(fila.tag);
    mapa.set(fila.transaccionId, lista);
  }
  return mapa;
}

/** Prende/apaga un tag puntual en una transacción — pensado para un picker rápido (un toque = un cambio). */
export async function alternarTagDeTransaccion(transaccionId: number, tagId: number, activo: boolean): Promise<void> {
  if (activo) {
    await db.insert(transaccionesTags).values({ transaccionId, tagId }).onConflictDoNothing();
  } else {
    await db
      .delete(transaccionesTags)
      .where(and(eq(transaccionesTags.transaccionId, transaccionId), eq(transaccionesTags.tagId, tagId)));
  }
}

/** Prende/apaga "sin contabilizar" en una transacción — mismo picker rápido, sin pasar por el form completo. */
export async function alternarExcluida(transaccionId: number, excluida: boolean): Promise<void> {
  await db.update(transacciones).set({ excluida }).where(eq(transacciones.id, transaccionId));
}

function signo(tipo: string): 1 | -1 {
  return tipo === "ingreso" || tipo === "devolucion" || tipo === "ajuste" ? 1 : -1;
}

/**
 * Saldo reconstruido: saldo_inicial + transacciones propias +/- transferencias
 * internas recibidas. La suma se hace en SQL (no trayendo cada fila para
 * sumarla en JS) — Turso es una base remota, así que el costo real está en
 * viajar cada fila por la red, no en la suma en sí. Con el índice en
 * cuenta_id/cuenta_destino_id (ver migración 0016), esto es O(1) en la
 * práctica sin importar cuánto crezca el historial.
 */
export async function saldoCuenta(cuentaId: number): Promise<number> {
  const cuenta = await db.select().from(cuentas).where(eq(cuentas.id, cuentaId)).get();
  if (!cuenta) return 0;

  const propias = await db
    .select({
      total: sql<number>`coalesce(sum(case when ${transacciones.tipo} in ('ingreso', 'devolucion', 'ajuste') then ${transacciones.monto} else -${transacciones.monto} end), 0)`,
    })
    .from(transacciones)
    .where(eq(transacciones.cuentaId, cuentaId))
    .get();
  const recibidas = await db
    .select({ total: sql<number>`coalesce(sum(${transacciones.monto}), 0)` })
    .from(transacciones)
    .where(eq(transacciones.cuentaDestinoId, cuentaId))
    .get();

  return cuenta.saldoInicial + (propias?.total ?? 0) + (recibidas?.total ?? 0);
}

export async function saldoTotalLiquido(): Promise<number> {
  const todas = await listarCuentas();
  const saldos = await Promise.all(todas.map((c) => saldoCuenta(c.id)));
  return saldos.reduce((a, b) => a + b, 0);
}

function rangoMes(mes: string): { desde: string; hasta: string } {
  // mes = "YYYY-MM"
  const [anio, m] = mes.split("-").map(Number);
  const desde = `${mes}-01`;
  const siguiente = m === 12 ? `${anio + 1}-01` : `${anio}-${String(m + 1).padStart(2, "0")}`;
  return { desde, hasta: `${siguiente}-01` };
}

// `limit` es opcional a propósito: la vista paginada de Movimientos lo pasa
// explícitamente, pero el resto de funciones (resumenMes, presupuestoPorCategoria,
// ejecutarMotorTransferencias) necesitan SIEMPRE el mes completo para que los
// totales no queden truncados — nunca deben depender del valor por defecto.
export async function transaccionesDelMes(mes: string, limit?: number, offset: number = 0) {
  const { desde, hasta } = rangoMes(mes);
  const query = db
    .select()
    .from(transacciones)
    .where(and(gte(transacciones.fecha, desde), lt(transacciones.fecha, hasta)))
    .orderBy(desc(transacciones.fecha));
  return limit !== undefined ? query.limit(limit).offset(offset) : query;
}

export async function obtenerTransaccion(id: number) {
  return db.select().from(transacciones).where(eq(transacciones.id, id)).get();
}

export async function resumenMes(mes: string) {
  const txs = await transaccionesDelMes(mes);
  const excluidas = await idsCategoriasExcluidas();
  let ingresos = 0;
  let gastos = 0;
  let transferenciasInternas = 0;
  const porCategoria = new Map<number | null, number>();

  for (const t of txs) {
    if (t.esTransferenciaInterna) {
      transferenciasInternas += t.monto;
      continue;
    }
    if (t.excluida) continue;
    if (t.tipo === "ingreso") {
      ingresos += t.monto;
      continue;
    }
    // excluirDeGastoReal es "no cuenta como gasto real" (transferencias entre
    // billeteras propias, pruebas, etc.) — no debe aplicarse a ingresos, solo
    // llegamos acá para los tipos que sí son gasto/devolución.
    if (t.categoriaId !== null && excluidas.has(t.categoriaId)) continue;
    if (t.tipo === "devolucion") {
      // No es un ingreso real ni un gasto nuevo — reduce el gasto que ya se
      // había contado (o lo deja en 0 si la compra original no está en el
      // sistema), nunca debe sumarse como si fuera un consumo más.
      gastos -= t.monto;
      if (t.categoriaId !== null) {
        porCategoria.set(t.categoriaId, (porCategoria.get(t.categoriaId) ?? 0) - t.monto);
      }
    } else {
      gastos += t.monto;
      porCategoria.set(t.categoriaId, (porCategoria.get(t.categoriaId) ?? 0) + t.monto);
    }
  }

  return { ingresos, gastos, transferenciasInternas, porCategoria, total: txs.length };
}

export interface FilaPresupuesto {
  categoria: Categoria;
  gasto: number;
  pctUsado: number | null; // null = sin límite fijado todavía
  sinMovimiento: boolean;
}

/**
 * Presupuesto por categoría, ordenado por urgencia (roadmap §12): % usado
 * descendente primero, luego las que tienen gasto pero sin límite fijado,
 * las categorías sin movimiento van al final.
 */
export async function presupuestoPorCategoria(mes: string): Promise<{
  filas: FilaPresupuesto[];
  sinCategorizar: number;
}> {
  const todasCategorias = await listarCategorias();
  const txs = await transaccionesDelMes(mes);
  const excluidas = await idsCategoriasExcluidas();

  // Una devolución no trae categoría propia (no es un gasto nuevo) — para
  // que la suma por categoría cuadre con el total, se resta de la misma
  // categoría que tuvo la compra original (mismo número de operación).
  const categoriaPorNumeroOperacion = new Map<string, number | null>();
  for (const t of txs) {
    if (t.tipo !== "devolucion" && t.numeroOperacion) {
      categoriaPorNumeroOperacion.set(t.numeroOperacion, t.categoriaId);
    }
  }

  const gastoPorCategoria = new Map<number, number>();
  let sinCategorizar = 0;

  for (const t of txs) {
    if (t.esTransferenciaInterna || t.tipo === "ingreso") continue;
    if (t.excluida) continue;
    const signo = t.tipo === "devolucion" ? -1 : 1;
    const categoriaId = t.tipo === "devolucion" && t.numeroOperacion
      ? categoriaPorNumeroOperacion.get(t.numeroOperacion) ?? null
      : t.categoriaId;
    if (categoriaId === null) {
      if (signo > 0) sinCategorizar += t.monto;
      continue;
    }
    if (excluidas.has(categoriaId)) continue;
    gastoPorCategoria.set(categoriaId, (gastoPorCategoria.get(categoriaId) ?? 0) + signo * t.monto);
  }

  const filas: FilaPresupuesto[] = todasCategorias.map((categoria) => {
    const gasto = gastoPorCategoria.get(categoria.id) ?? 0;
    const pctUsado = categoria.limiteMensual && categoria.limiteMensual > 0 ? (gasto / categoria.limiteMensual) * 100 : null;
    return { categoria, gasto, pctUsado, sinMovimiento: gasto === 0 };
  });

  filas.sort((a, b) => {
    if (a.sinMovimiento !== b.sinMovimiento) return a.sinMovimiento ? 1 : -1;
    if (a.pctUsado !== null && b.pctUsado !== null) return b.pctUsado - a.pctUsado;
    if (a.pctUsado !== null) return -1;
    if (b.pctUsado !== null) return 1;
    return b.gasto - a.gasto;
  });

  return { filas, sinCategorizar };
}

export interface DesgloseEtiqueta {
  nombre: string;
  monto: number;
}

/**
 * Desglose por etiqueta DENTRO de una categoría, para un mes — mismas reglas
 * de conteo que presupuestoPorCategoria (excluye transferencias internas,
 * ingresos y movimientos marcados "sin contabilizar"; una devolución se
 * imputa a la categoría de su compra original). Un movimiento con más de
 * una etiqueta suma su monto completo en cada una (no se reparte) — es
 * "cuánto tocó cada etiqueta", no una partición estricta del total.
 */
export async function desglosePorEtiqueta(categoriaId: number, mes: string): Promise<DesgloseEtiqueta[]> {
  const txs = await transaccionesDelMes(mes);

  const categoriaPorNumeroOperacion = new Map<string, number | null>();
  for (const t of txs) {
    if (t.tipo !== "devolucion" && t.numeroOperacion) {
      categoriaPorNumeroOperacion.set(t.numeroOperacion, t.categoriaId);
    }
  }

  const montoPorTransaccion = new Map<number, number>();
  for (const t of txs) {
    if (t.esTransferenciaInterna || t.tipo === "ingreso" || t.excluida) continue;
    const signoTx = t.tipo === "devolucion" ? -1 : 1;
    const catId =
      t.tipo === "devolucion" && t.numeroOperacion
        ? categoriaPorNumeroOperacion.get(t.numeroOperacion) ?? null
        : t.categoriaId;
    if (catId !== categoriaId) continue;
    montoPorTransaccion.set(t.id, (montoPorTransaccion.get(t.id) ?? 0) + signoTx * t.monto);
  }

  const ids = [...montoPorTransaccion.keys()];
  if (ids.length === 0) return [];

  const tagsMapa = await tagsPorTransaccion(ids);
  const totalPorEtiqueta = new Map<string, number>();
  for (const id of ids) {
    const monto = montoPorTransaccion.get(id) ?? 0;
    const tagsDeEsta = tagsMapa.get(id) ?? [];
    if (tagsDeEsta.length === 0) {
      totalPorEtiqueta.set("Sin etiqueta", (totalPorEtiqueta.get("Sin etiqueta") ?? 0) + monto);
    } else {
      for (const tag of tagsDeEsta) {
        totalPorEtiqueta.set(tag.nombre, (totalPorEtiqueta.get(tag.nombre) ?? 0) + monto);
      }
    }
  }

  return [...totalPorEtiqueta.entries()]
    .map(([nombre, monto]) => ({ nombre, monto }))
    .sort((a, b) => b.monto - a.monto);
}

export async function editarLimiteCategoria(categoriaId: number, limiteMensual: number | null) {
  await db.update(categorias).set({ limiteMensual }).where(eq(categorias.id, categoriaId));
}

/**
 * Corre el motor de matching (roadmap §4) sobre las transacciones del mes y
 * marca los pares encontrados como transferencia_interna. Ver
 * src/logic/motor-transferencias.ts para la lógica de matching en sí.
 */
export async function ejecutarMotorTransferencias(mes: string): Promise<number> {
  const { detectarTransferenciasInternas } = await import("../logic/motor-transferencias");
  const txs = await transaccionesDelMes(mes);
  const matches = detectarTransferenciasInternas(txs);

  for (const { salida, entrada } of matches) {
    await db
      .update(transacciones)
      .set({ esTransferenciaInterna: true, cuentaDestinoId: entrada.cuentaId })
      .where(eq(transacciones.id, salida.id));
    await db.update(transacciones).set({ esTransferenciaInterna: true }).where(eq(transacciones.id, entrada.id));
  }

  return matches.length;
}

export interface NuevaTransaccionManual {
  cuentaId: number;
  tipo: "compra" | "ingreso";
  monto: number;
  comercio: string;
  categoriaId: number | null;
  fecha: string;
  excluida?: boolean;
}

export async function crearTransaccionManual(input: NuevaTransaccionManual): Promise<number> {
  const [creada] = await db
    .insert(transacciones)
    .values({
      cuentaId: input.cuentaId,
      tipo: input.tipo,
      monto: input.monto,
      moneda: "PEN",
      comercio: input.comercio,
      fecha: input.fecha,
      categoriaId: input.categoriaId,
      categoriaConfirmada: input.categoriaId !== null,
      excluida: input.excluida ?? false,
      fuente: "manual",
    })
    .returning({ id: transacciones.id });
  return creada.id;
}

export interface EdicionTransaccion {
  id: number;
  cuentaId: number;
  // No se restringe a "compra" | "ingreso": a diferencia de una creación
  // manual, editar una transacción real de correo (transferencia, retiro,
  // pago_servicio, devolución) debe conservar su tipo original — cambiarlo
  // a "compra" podía chocar con el índice único (numero_operacion, tipo)
  // cuando ya existe una compra con el mismo número de operación (el caso
  // típico de Uber: compra + devolución comparten número), lo que tumbaba
  // la página al editar.
  tipo: string;
  monto: number;
  comercio: string;
  categoriaId: number | null;
  fecha: string;
  excluida?: boolean;
}

export async function actualizarTransaccion(input: EdicionTransaccion) {
  await db
    .update(transacciones)
    .set({
      cuentaId: input.cuentaId,
      tipo: input.tipo,
      monto: input.monto,
      comercio: input.comercio,
      categoriaId: input.categoriaId,
      categoriaConfirmada: input.categoriaId !== null,
      fecha: input.fecha,
      excluida: input.excluida ?? false,
    })
    .where(eq(transacciones.id, input.id));
}

export interface NuevaCuenta {
  nombre: string;
  banco: string;
  tipo: string;
  saldoInicial: number;
}

export async function crearCuenta(input: NuevaCuenta) {
  await db.insert(cuentas).values(input);
}

export async function alternarDestacada(cuentaId: number, destacada: boolean) {
  await db.update(cuentas).set({ destacada }).where(eq(cuentas.id, cuentaId));
}

export async function actualizarBilletera(cuentaId: number, billetera: "yape" | "plin" | null) {
  await db.update(cuentas).set({ billetera }).where(eq(cuentas.id, cuentaId));
}

export async function renombrarCuenta(cuentaId: number, nombre: string) {
  await db.update(cuentas).set({ nombre }).where(eq(cuentas.id, cuentaId));
}

/**
 * Corrige el saldo de una cuenta insertando una transacción de tipo 'ajuste'
 * por el delta contra saldoCuenta(), en vez de tocar saldoInicial en
 * silencio (a diferencia de corregirDeudaTarjeta) — así queda evidencia
 * visible en Movimientos, con la nota de por qué se corrigió. excluida=true
 * para que no cuente como ingreso/gasto real (resumenMes,
 * presupuestoPorCategoria, etc.), pero sí sigue contando para saldoCuenta()
 * como cualquier otra transacción.
 */
export async function ajustarSaldoCuenta(cuentaId: number, saldoReal: number, nota: string): Promise<void> {
  const saldoActual = await saldoCuenta(cuentaId);
  const delta = Math.round((saldoReal - saldoActual) * 100) / 100;
  if (delta === 0) return;
  await db.insert(transacciones).values({
    cuentaId,
    tipo: "ajuste",
    monto: delta,
    moneda: "PEN",
    comercio: nota,
    descripcion: nota,
    fecha: new Date().toISOString(),
    categoriaId: null,
    categoriaConfirmada: false,
    excluida: true,
    fuente: "manual",
  });
}

/**
 * Serie de patrimonio neto reproduciendo el historial de transacciones día a
 * día — no hay tabla de snapshots, se reconstruye igual que `saldoCuenta`
 * pero acumulando en el tiempo. Excluye tarjetas de crédito (deuda, no
 * patrimonio). Devuelve como máximo los últimos `dias` días; menos si el
 * historial real es más corto.
 */
export async function patrimonioHistorico(dias: number): Promise<{ fecha: string; valor: number }[]> {
  const todasCuentas = await listarCuentas();
  const cuentasLiquidas = todasCuentas.filter((c) => c.tipo !== "tarjeta_credito");
  const idsLiquidas = new Set(cuentasLiquidas.map((c) => c.id));

  const todasTx = await db.select().from(transacciones).orderBy(asc(transacciones.fecha));

  const saldoPorCuenta = new Map<number, number>();
  for (const c of cuentasLiquidas) saldoPorCuenta.set(c.id, c.saldoInicial);

  function totalActual(): number {
    let total = 0;
    for (const v of saldoPorCuenta.values()) total += v;
    return total;
  }

  const totalPorDia = new Map<string, number>();
  for (const t of todasTx) {
    let cambia = false;
    if (idsLiquidas.has(t.cuentaId)) {
      saldoPorCuenta.set(t.cuentaId, (saldoPorCuenta.get(t.cuentaId) ?? 0) + signo(t.tipo) * t.monto);
      cambia = true;
    }
    if (t.cuentaDestinoId !== null && idsLiquidas.has(t.cuentaDestinoId)) {
      saldoPorCuenta.set(t.cuentaDestinoId, (saldoPorCuenta.get(t.cuentaDestinoId) ?? 0) + t.monto);
      cambia = true;
    }
    if (cambia) totalPorDia.set(t.fecha.slice(0, 10), totalActual());
  }

  if (totalPorDia.size === 0) return [];

  const primerDia = [...totalPorDia.keys()].sort()[0];
  const hoy = new Date().toISOString().slice(0, 10);

  const serie: { fecha: string; valor: number }[] = [];
  let ultimoValor = 0;
  const cursor = new Date(`${primerDia}T00:00:00`);
  const fin = new Date(`${hoy}T00:00:00`);
  while (cursor <= fin) {
    const diaStr = cursor.toISOString().slice(0, 10);
    if (totalPorDia.has(diaStr)) ultimoValor = totalPorDia.get(diaStr)!;
    serie.push({ fecha: diaStr, valor: ultimoValor });
    cursor.setDate(cursor.getDate() + 1);
  }

  return serie.slice(-dias);
}

/** Agrupa filas ya calculadas de presupuestoPorCategoria por bucket (fijos/inversion/ahorro/libre) — sin tocar la base. */
export function agruparPorBucket(filas: FilaPresupuesto[]): Record<string, number> {
  const totales: Record<string, number> = { fijos: 0, inversion: 0, ahorro: 0, libre: 0 };
  for (const fila of filas) {
    totales[fila.categoria.bucket] = (totales[fila.categoria.bucket] ?? 0) + fila.gasto;
  }
  return totales;
}

export interface CuotaActiva {
  id: number;
  comercio: string;
  montoCuota: number;
  totalCuotas: number;
  cuotasPagadasTotal: number; // base histórica + pagos registrados por mes
  tarjetaNombre: string;
  mesActual: string; // "YYYY-MM" — para que la UI arme el label "Mes: pagada/pendiente"
  pagadaEsteMes: boolean;
}

/**
 * Cuotas que todavía no terminaron de pagarse. A diferencia del modelo
 * viejo, una cuota YA pagada este mes sigue apareciendo en la lista (con
 * `pagadaEsteMes = true`) en vez de desaparecer — así se puede ver/deshacer,
 * y `totalMensual` (lo que se descuenta de "Disponible real hoy") es lo
 * único que la excluye.
 */
export async function cuotasActivas(): Promise<{ filas: CuotaActiva[]; totalMensual: number }> {
  const mesActual = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const compras = await db
    .select({
      id: comprasCuotas.id,
      comercio: comprasCuotas.comercio,
      montoCuota: comprasCuotas.montoCuota,
      cuotasPagadasBase: comprasCuotas.cuotasPagadas,
      totalCuotas: comprasCuotas.totalCuotas,
      tarjetaNombre: tarjetas.nombre,
    })
    .from(comprasCuotas)
    .leftJoin(tarjetas, eq(comprasCuotas.tarjetaId, tarjetas.id));

  const pagosPorCompra = new Map<number, { mes: string }[]>();
  if (compras.length > 0) {
    const todosPagos = await db
      .select({ compraCuotaId: pagosCuota.compraCuotaId, mes: pagosCuota.mes })
      .from(pagosCuota)
      .where(inArray(pagosCuota.compraCuotaId, compras.map((c) => c.id)));
    for (const p of todosPagos) {
      const lista = pagosPorCompra.get(p.compraCuotaId) ?? [];
      lista.push({ mes: p.mes });
      pagosPorCompra.set(p.compraCuotaId, lista);
    }
  }

  const filas: CuotaActiva[] = [];
  let totalMensual = 0;
  for (const c of compras) {
    const pagos = pagosPorCompra.get(c.id) ?? [];
    const cuotasPagadasTotal = c.cuotasPagadasBase + pagos.length;
    if (cuotasPagadasTotal >= c.totalCuotas) continue; // ya terminó de pagarse, no es "activa"
    const pagadaEsteMes = pagos.some((p) => p.mes === mesActual);
    filas.push({
      id: c.id,
      comercio: c.comercio,
      montoCuota: c.montoCuota,
      totalCuotas: c.totalCuotas,
      cuotasPagadasTotal,
      tarjetaNombre: c.tarjetaNombre ?? "—",
      mesActual,
      pagadaEsteMes,
    });
    if (!pagadaEsteMes) totalMensual += c.montoCuota;
  }
  return { filas, totalMensual };
}

/** Marca o desmarca el pago del mes actual (u otro mes puntual) de una cuota. */
export async function alternarPagoCuotaMes(compraCuotaId: number, mes: string, pagada: boolean): Promise<void> {
  if (pagada) {
    await db.insert(pagosCuota).values({ compraCuotaId, mes }).onConflictDoNothing();
  } else {
    await db
      .delete(pagosCuota)
      .where(and(eq(pagosCuota.compraCuotaId, compraCuotaId), eq(pagosCuota.mes, mes)));
  }
}

/**
 * Corrige el total de cuotas pagadas de una compra (ej. si el conteo inicial
 * quedó mal, o cargaste un pago de más por error). Ajusta la BASE histórica
 * para que base + pagos registrados por mes dé el total que se le pasa —
 * los pagos por mes ya registrados no se tocan.
 */
export async function editarCuotasPagadas(compraCuotaId: number, nuevoTotal: number, nuevoComercio?: string): Promise<void> {
  const pagos = await db.select().from(pagosCuota).where(eq(pagosCuota.compraCuotaId, compraCuotaId));
  const nuevaBase = Math.max(0, nuevoTotal - pagos.length);
  await db
    .update(comprasCuotas)
    .set({ cuotasPagadas: nuevaBase, ...(nuevoComercio ? { comercio: nuevoComercio } : {}) })
    .where(eq(comprasCuotas.id, compraCuotaId));
}

export interface MetaCompraConProgreso {
  id: number;
  nombre: string;
  precioObjetivo: number;
  fechaDeseada: string | null;
  metodoPago: string;
  estado: string;
  categoriaId: number;
  compraCuotaId: number | null;
  progreso: number;
  sugerenciaMensual: number | null;
}

export interface NuevaMetaCompra {
  nombre: string;
  precioObjetivo: number;
  fechaDeseada: string | null;
  metodoPago: string;
}

/**
 * Crea la meta Y su categoría dedicada (bucket 'ahorro') en el mismo paso —
 * esa categoría es la que trackea el progreso, nunca un número aparte (ver
 * comentario en schema.ts, mismo principio que fondoEmergencia).
 */
export async function crearMetaCompra(input: NuevaMetaCompra): Promise<void> {
  const [categoria] = await db
    .insert(categorias)
    .values({ nombre: `Meta: ${input.nombre}`, bucket: "ahorro" })
    .returning({ id: categorias.id });
  await db.insert(metasCompra).values({ ...input, categoriaId: categoria.id });
}

export async function editarMetaCompra(id: number, input: NuevaMetaCompra): Promise<void> {
  await db.update(metasCompra).set(input).where(eq(metasCompra.id, id));
}

/** Vincula (o desvincula, con null) una compra en cuotas ya concretada — para método 'cuotas'. */
export async function vincularCompraCuotaAMeta(id: number, compraCuotaId: number | null): Promise<void> {
  await db.update(metasCompra).set({ compraCuotaId }).where(eq(metasCompra.id, id));
}

export async function cambiarEstadoMeta(id: number, estado: "activa" | "completada" | "cancelada"): Promise<void> {
  await db.update(metasCompra).set({ estado }).where(eq(metasCompra.id, id));
}

/** Borra la meta pero archiva (no borra) su categoría — así los movimientos ya categorizados ahí no pierden el nombre. */
export async function eliminarMetaCompra(id: number): Promise<void> {
  const meta = await db.select().from(metasCompra).where(eq(metasCompra.id, id)).get();
  if (!meta) return;
  await db.delete(metasCompra).where(eq(metasCompra.id, id));
  await db.update(categorias).set({ archivada: true }).where(eq(categorias.id, meta.categoriaId));
}

export async function listarComprasCuotas() {
  return db.select().from(comprasCuotas).orderBy(desc(comprasCuotas.fechaCompra));
}

/**
 * Progreso: si es 'cuotas' y ya está vinculada a una compra real, se deriva
 * de ahí (cuotas pagadas × monto de cuota). Si no, se deriva de la suma
 * histórica (todo el tiempo, no solo el mes) de movimientos en la categoría
 * dedicada — "aportar a la meta" es simplemente registrar un movimiento con
 * esa categoría, como cualquier otro.
 */
export async function listarMetasCompra(): Promise<MetaCompraConProgreso[]> {
  const metas = await db.select().from(metasCompra).where(eq(metasCompra.estado, "activa")).orderBy(desc(metasCompra.createdAt));
  const resultado: MetaCompraConProgreso[] = [];

  for (const m of metas) {
    let progreso = 0;
    if (m.metodoPago === "cuotas" && m.compraCuotaId !== null) {
      const compra = await db.select().from(comprasCuotas).where(eq(comprasCuotas.id, m.compraCuotaId)).get();
      if (compra) {
        const pagos = await db.select().from(pagosCuota).where(eq(pagosCuota.compraCuotaId, compra.id));
        progreso = (compra.cuotasPagadas + pagos.length) * compra.montoCuota;
      }
    } else {
      const txs = await db.select().from(transacciones).where(eq(transacciones.categoriaId, m.categoriaId));
      progreso = txs.reduce((acc, t) => acc + (t.esTransferenciaInterna || t.excluida ? 0 : t.monto), 0);
    }

    let sugerenciaMensual: number | null = null;
    if (m.fechaDeseada) {
      const hoy = new Date();
      const objetivo = new Date(m.fechaDeseada);
      const mesesRestantes = Math.max(
        1,
        (objetivo.getFullYear() - hoy.getFullYear()) * 12 + (objetivo.getMonth() - hoy.getMonth())
      );
      const faltante = m.precioObjetivo - progreso;
      sugerenciaMensual = faltante > 0 ? faltante / mesesRestantes : 0;
    }

    resultado.push({ ...m, progreso, sugerenciaMensual });
  }

  return resultado;
}

// Umbral bajo el cual una compra cuenta como "gasto hormiga" — pequeños
// consumos que por separado no pesan pero suman fuerte proyectados al año.
const UMBRAL_GASTO_HORMIGA = 20;

export interface GastoHormiga {
  porCategoria: { nombre: string; monto: number }[];
  totalMes: number;
  proyeccionAnual: number;
}

export async function gastoHormigaAnualizado(mes: string): Promise<GastoHormiga> {
  const { desde, hasta } = rangoMes(mes);
  const filas = await db
    .select()
    .from(transacciones)
    .where(
      and(
        gte(transacciones.fecha, desde),
        lt(transacciones.fecha, hasta),
        eq(transacciones.tipo, "compra"),
        eq(transacciones.esTransferenciaInterna, false),
        eq(transacciones.excluida, false),
        lt(transacciones.monto, UMBRAL_GASTO_HORMIGA)
      )
    );

  const todasCategorias = await listarCategorias();
  const categoriaPorId = new Map(todasCategorias.map((c) => [c.id, c]));
  const excluidas = await idsCategoriasExcluidas();
  const filasContables = filas.filter((f) => f.categoriaId === null || !excluidas.has(f.categoriaId));

  const porCategoriaMap = new Map<string, number>();
  for (const f of filasContables) {
    const nombre = (f.categoriaId && categoriaPorId.get(f.categoriaId)?.nombre) || "Sin categoría";
    porCategoriaMap.set(nombre, (porCategoriaMap.get(nombre) ?? 0) + f.monto);
  }
  const porCategoria = [...porCategoriaMap.entries()]
    .map(([nombre, monto]) => ({ nombre, monto }))
    .sort((a, b) => b.monto - a.monto);

  const totalMes = filasContables.reduce((acc, f) => acc + f.monto, 0);
  return { porCategoria, totalMes, proyeccionAnual: totalMes * 12 };
}

export interface SuscripcionInfo {
  nombre: string;
  monto: number;
}

/**
 * No hay detección automática por recurrencia todavía (roadmap §8) — esto
 * es la versión simple: cualquier movimiento del mes con categoría o
 * etiqueta "Suscripciones" (sin importar mayúsculas) cuenta acá, sin
 * trackear si ya se pagó o no (a diferencia de cuotas, que sí lo trackea).
 */
export async function suscripcionesDelMes(mes: string): Promise<{ filas: SuscripcionInfo[]; total: number }> {
  const txs = await transaccionesDelMes(mes);
  const todasCategorias = await listarCategorias();
  const todosTags = await listarTags();
  const categoriaIds = new Set(todasCategorias.filter((c) => /suscripci/i.test(c.nombre)).map((c) => c.id));
  const tagIds = new Set(todosTags.filter((t) => /suscripci/i.test(t.nombre)).map((t) => t.id));
  const tagsPorTx = await tagsPorTransaccion(txs.map((t) => t.id));

  const porComercio = new Map<string, number>();
  for (const t of txs) {
    if (t.esTransferenciaInterna || t.excluida) continue;
    const porCategoria = t.categoriaId !== null && categoriaIds.has(t.categoriaId);
    const porTag = (tagsPorTx.get(t.id) ?? []).some((tag) => tagIds.has(tag.id));
    if (!porCategoria && !porTag) continue;
    const nombre = t.comercio || "Sin nombre";
    porComercio.set(nombre, (porComercio.get(nombre) ?? 0) + t.monto);
  }

  const filas = [...porComercio.entries()]
    .map(([nombre, monto]) => ({ nombre, monto }))
    .sort((a, b) => b.monto - a.monto);
  const total = filas.reduce((acc, f) => acc + f.monto, 0);
  return { filas, total };
}

export interface DeudaPendiente {
  cuenta: Cuenta;
  saldo: number;
  fechaVencimiento: string | null;
}

/** Deriva la deuda directo del saldo de las cuentas tipo tarjeta_credito — sin tabla de deudas separada. */
export async function deudaPendiente(): Promise<DeudaPendiente[]> {
  const tarjetasCredito = await db.select().from(cuentas).where(eq(cuentas.tipo, "tarjeta_credito"));
  if (tarjetasCredito.length === 0) return [];

  const cuentaIds = tarjetasCredito.map((c) => c.id);
  const [saldos, tarjetasDeCuentas] = await Promise.all([
    Promise.all(tarjetasCredito.map((c) => saldoCuenta(c.id))),
    db.select().from(tarjetas).where(inArray(tarjetas.cuentaId, cuentaIds)),
  ]);
  const tarjetaPorCuentaId = new Map(tarjetasDeCuentas.map((t) => [t.cuentaId, t]));

  const resultado: DeudaPendiente[] = [];
  tarjetasCredito.forEach((cuenta, i) => {
    const saldo = saldos[i];
    if (saldo >= 0) return;
    const tarjeta = tarjetaPorCuentaId.get(cuenta.id);
    resultado.push({ cuenta, saldo: -saldo, fechaVencimiento: tarjeta?.fechaVencimiento ?? null });
  });
  return resultado;
}

/**
 * Corrige la deuda mostrada de una tarjeta ajustando el `saldoInicial` de su
 * cuenta — mismo lever que ya usa `saldoCuenta` para todo lo demás, así el
 * número sigue derivado del saldo real en vez de guardarse aparte.
 */
export async function corregirDeudaTarjeta(cuentaId: number, nuevaDeuda: number): Promise<void> {
  const cuenta = await db.select().from(cuentas).where(eq(cuentas.id, cuentaId)).get();
  if (!cuenta) return;
  const deudaActual = -(await saldoCuenta(cuentaId));
  const nuevoSaldoInicial = cuenta.saldoInicial + (deudaActual - nuevaDeuda);
  await db.update(cuentas).set({ saldoInicial: nuevoSaldoInicial }).where(eq(cuentas.id, cuentaId));
}

export interface FondoEmergenciaInfo {
  cuenta: Cuenta;
  metaMeses: number;
  saldoActual: number;
  metaMonto: number;
}

export async function obtenerFondoEmergencia(): Promise<FondoEmergenciaInfo | null> {
  const fila = await db.select().from(fondoEmergencia).orderBy(desc(fondoEmergencia.id)).limit(1).get();
  if (!fila) return null;

  const cuenta = await db.select().from(cuentas).where(eq(cuentas.id, fila.cuentaId)).get();
  if (!cuenta) return null;

  const saldoActual = await saldoCuenta(cuenta.id);
  const mes = new Date().toISOString().slice(0, 7);
  const { filas } = await presupuestoPorCategoria(mes);
  const gastosFijos = agruparPorBucket(filas).fijos ?? 0;

  return { cuenta, metaMeses: fila.metaMeses, saldoActual, metaMonto: fila.metaMeses * gastosFijos };
}

export async function configurarFondoEmergencia(input: { cuentaId: number; metaMeses: number }) {
  const existente = await db.select().from(fondoEmergencia).orderBy(desc(fondoEmergencia.id)).limit(1).get();
  if (existente) {
    await db.update(fondoEmergencia).set(input).where(eq(fondoEmergencia.id, existente.id));
  } else {
    await db.insert(fondoEmergencia).values(input);
  }
}

export interface ConfiguracionIa {
  sugerirConIa: boolean;
  aprenderReglasNuevas: boolean;
}

/** Sin fila todavía = comportamiento actual (ambas prendidas) — no cambia nada hasta que alguien las toque. */
export async function obtenerConfiguracionIA(): Promise<ConfiguracionIa> {
  const fila = await db.select().from(configuracionIa).orderBy(desc(configuracionIa.id)).limit(1).get();
  if (!fila) return { sugerirConIa: true, aprenderReglasNuevas: true };
  return { sugerirConIa: fila.sugerirConIa, aprenderReglasNuevas: fila.aprenderReglasNuevas };
}

export async function actualizarConfiguracionIA(input: Partial<ConfiguracionIa>): Promise<void> {
  const existente = await db.select().from(configuracionIa).orderBy(desc(configuracionIa.id)).limit(1).get();
  if (existente) {
    await db.update(configuracionIa).set(input).where(eq(configuracionIa.id, existente.id));
  } else {
    await db.insert(configuracionIa).values({ sugerirConIa: true, aprenderReglasNuevas: true, ...input });
  }
}

/**
 * Dinero por cobrar (préstamos hechos, ventas pendientes) — lo inverso de
 * `deudaPendiente`. Tracking a mano, no se cruza con `transacciones` (ver
 * comentario en schema.ts): cuando la plata real llega a una cuenta, esa
 * transferencia la captura el webhook por su cuenta.
 */
export async function listarCobranzas() {
  return db.select().from(cobranzas).orderBy(desc(cobranzas.createdAt));
}

export interface NuevaCobranza {
  descripcion: string;
  montoEsperado: number;
}

export async function crearCobranza(input: NuevaCobranza) {
  await db.insert(cobranzas).values(input);
}

export async function editarCobranza(id: number, input: NuevaCobranza) {
  await db.update(cobranzas).set(input).where(eq(cobranzas.id, id));
}

export async function marcarCobranzaCobrada(id: number, cobrado: boolean) {
  await db
    .update(cobranzas)
    .set({ estado: cobrado ? "cobrado" : "pendiente", fechaCobro: cobrado ? new Date().toISOString().slice(0, 10) : null })
    .where(eq(cobranzas.id, id));
}

export async function eliminarCobranza(id: number) {
  await db.delete(cobranzas).where(eq(cobranzas.id, id));
}

/**
 * Deudas que no vienen de una tarjeta de crédito trackeada (esas ya las
 * deriva `deudaPendiente()` solas, del saldo de la cuenta) — para un
 * préstamo o cualquier otra deuda sin cuenta propia en el sistema.
 */
export async function listarDeudasManuales() {
  return db.select().from(deudasManuales).orderBy(desc(deudasManuales.createdAt));
}

export interface NuevaDeudaManual {
  descripcion: string;
  montoAdeudado: number;
}

export async function crearDeudaManual(input: NuevaDeudaManual) {
  await db.insert(deudasManuales).values(input);
}

export async function editarMontoDeudaManual(id: number, montoAdeudado: number) {
  await db.update(deudasManuales).set({ montoAdeudado }).where(eq(deudasManuales.id, id));
}

export async function marcarDeudaManualPagada(id: number, pagada: boolean) {
  await db
    .update(deudasManuales)
    .set({ estado: pagada ? "pagada" : "pendiente", fechaPago: pagada ? new Date().toISOString().slice(0, 10) : null })
    .where(eq(deudasManuales.id, id));
}

export async function eliminarDeudaManual(id: number) {
  await db.delete(deudasManuales).where(eq(deudasManuales.id, id));
}
