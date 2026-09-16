import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "./client";
import { categorias, cobranzas, comprasCuotas, cuentas, fondoEmergencia, tarjetas, transacciones } from "./schema";

export type Cuenta = typeof cuentas.$inferSelect;
export type Categoria = typeof categorias.$inferSelect;
export type Transaccion = typeof transacciones.$inferSelect;
export type Cobranza = typeof cobranzas.$inferSelect;

export async function listarCuentas() {
  return db.select().from(cuentas).orderBy(asc(cuentas.id));
}

export async function listarCategorias() {
  return db.select().from(categorias).orderBy(asc(categorias.nombre));
}

function signo(tipo: string): 1 | -1 {
  return tipo === "ingreso" || tipo === "devolucion" ? 1 : -1;
}

/** Saldo reconstruido: saldo_inicial + transacciones propias +/- transferencias internas recibidas. */
export async function saldoCuenta(cuentaId: number): Promise<number> {
  const cuenta = await db.select().from(cuentas).where(eq(cuentas.id, cuentaId)).get();
  if (!cuenta) return 0;

  const propias = await db.select().from(transacciones).where(eq(transacciones.cuentaId, cuentaId));
  const recibidas = await db
    .select()
    .from(transacciones)
    .where(eq(transacciones.cuentaDestinoId, cuentaId));

  let total = cuenta.saldoInicial;
  for (const t of propias) total += signo(t.tipo) * t.monto;
  for (const t of recibidas) total += t.monto;
  return total;
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

export async function transaccionesDelMes(mes: string) {
  const { desde, hasta } = rangoMes(mes);
  return db
    .select()
    .from(transacciones)
    .where(and(gte(transacciones.fecha, desde), lt(transacciones.fecha, hasta)))
    .orderBy(desc(transacciones.fecha));
}

export async function resumenMes(mes: string) {
  const txs = await transaccionesDelMes(mes);
  let ingresos = 0;
  let gastos = 0;
  let transferenciasInternas = 0;
  const porCategoria = new Map<number | null, number>();

  for (const t of txs) {
    if (t.esTransferenciaInterna) {
      transferenciasInternas += t.monto;
      continue;
    }
    if (t.tipo === "ingreso") {
      ingresos += t.monto;
    } else if (t.tipo === "devolucion") {
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
    const signo = t.tipo === "devolucion" ? -1 : 1;
    const categoriaId = t.tipo === "devolucion" && t.numeroOperacion
      ? categoriaPorNumeroOperacion.get(t.numeroOperacion) ?? null
      : t.categoriaId;
    if (categoriaId === null) {
      if (signo > 0) sinCategorizar += t.monto;
      continue;
    }
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
}

export async function crearTransaccionManual(input: NuevaTransaccionManual) {
  await db.insert(transacciones).values({
    cuentaId: input.cuentaId,
    tipo: input.tipo,
    monto: input.monto,
    moneda: "PEN",
    comercio: input.comercio,
    fecha: input.fecha,
    categoriaId: input.categoriaId,
    categoriaConfirmada: input.categoriaId !== null,
    fuente: "manual",
  });
}

export interface EdicionTransaccion {
  id: number;
  cuentaId: number;
  tipo: "compra" | "ingreso";
  monto: number;
  comercio: string;
  categoriaId: number | null;
  fecha: string;
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
  cuotasPagadas: number;
  totalCuotas: number;
  tarjetaNombre: string;
}

export async function cuotasActivas(): Promise<{ filas: CuotaActiva[]; totalMensual: number }> {
  const filas = await db
    .select({
      id: comprasCuotas.id,
      comercio: comprasCuotas.comercio,
      montoCuota: comprasCuotas.montoCuota,
      cuotasPagadas: comprasCuotas.cuotasPagadas,
      totalCuotas: comprasCuotas.totalCuotas,
      tarjetaNombre: tarjetas.nombre,
    })
    .from(comprasCuotas)
    .leftJoin(tarjetas, eq(comprasCuotas.tarjetaId, tarjetas.id))
    .where(lt(comprasCuotas.cuotasPagadas, comprasCuotas.totalCuotas));

  const filasConNombre = filas.map((f) => ({ ...f, tarjetaNombre: f.tarjetaNombre ?? "—" }));
  const totalMensual = filasConNombre.reduce((acc, f) => acc + f.montoCuota, 0);
  return { filas: filasConNombre, totalMensual };
}

export async function marcarCuotaPagada(cuotaId: number) {
  const cuota = await db.select().from(comprasCuotas).where(eq(comprasCuotas.id, cuotaId)).get();
  if (!cuota || cuota.cuotasPagadas >= cuota.totalCuotas) return;
  await db
    .update(comprasCuotas)
    .set({ cuotasPagadas: cuota.cuotasPagadas + 1 })
    .where(eq(comprasCuotas.id, cuotaId));
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
        lt(transacciones.monto, UMBRAL_GASTO_HORMIGA)
      )
    );

  const todasCategorias = await listarCategorias();
  const categoriaPorId = new Map(todasCategorias.map((c) => [c.id, c]));
  const porCategoriaMap = new Map<string, number>();
  for (const f of filas) {
    const nombre = (f.categoriaId && categoriaPorId.get(f.categoriaId)?.nombre) || "Sin categoría";
    porCategoriaMap.set(nombre, (porCategoriaMap.get(nombre) ?? 0) + f.monto);
  }
  const porCategoria = [...porCategoriaMap.entries()]
    .map(([nombre, monto]) => ({ nombre, monto }))
    .sort((a, b) => b.monto - a.monto);

  const totalMes = filas.reduce((acc, f) => acc + f.monto, 0);
  return { porCategoria, totalMes, proyeccionAnual: totalMes * 12 };
}

export interface DeudaPendiente {
  cuenta: Cuenta;
  saldo: number;
  fechaVencimiento: string | null;
}

/** Deriva la deuda directo del saldo de las cuentas tipo tarjeta_credito — sin tabla de deudas separada. */
export async function deudaPendiente(): Promise<DeudaPendiente[]> {
  const tarjetasCredito = await db.select().from(cuentas).where(eq(cuentas.tipo, "tarjeta_credito"));
  const resultado: DeudaPendiente[] = [];
  for (const cuenta of tarjetasCredito) {
    const saldo = await saldoCuenta(cuenta.id);
    if (saldo >= 0) continue;
    const tarjeta = await db.select().from(tarjetas).where(eq(tarjetas.cuentaId, cuenta.id)).get();
    resultado.push({ cuenta, saldo: -saldo, fechaVencimiento: tarjeta?.fechaVencimiento ?? null });
  }
  return resultado;
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

export async function marcarCobranzaCobrada(id: number, cobrado: boolean) {
  await db
    .update(cobranzas)
    .set({ estado: cobrado ? "cobrado" : "pendiente", fechaCobro: cobrado ? new Date().toISOString().slice(0, 10) : null })
    .where(eq(cobranzas.id, id));
}

export async function eliminarCobranza(id: number) {
  await db.delete(cobranzas).where(eq(cobranzas.id, id));
}
