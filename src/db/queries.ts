import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "./client";
import { categorias, cuentas, transacciones } from "./schema";

export type Cuenta = typeof cuentas.$inferSelect;
export type Categoria = typeof categorias.$inferSelect;
export type Transaccion = typeof transacciones.$inferSelect;

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
