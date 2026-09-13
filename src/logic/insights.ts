import type { FilaPresupuesto } from "@/db/queries";

export interface Insight {
  tipo: "warn" | "good" | "info";
  eyebrow: string;
  numero: string;
  corto: string;
  largo: string;
}

export interface ContextoInsights {
  presupuesto: FilaPresupuesto[];
  sinCategorizar: number;
  resumen: { ingresos: number; gastos: number; transferenciasInternas: number };
}

type Regla = (ctx: ContextoInsights) => Insight | null;

/**
 * Catálogo de reglas del roadmap §11 — no son 4 tarjetas fijas, es una
 * lista de condiciones evaluadas cada vez que se abre Inicio; se muestran
 * las que disparen, con un fallback genérico si ninguna lo hace. Crece con
 * el tiempo (más historial habilita reglas como "vs. mes anterior" o
 * "proyección de fondo de emergencia", que hoy no son computables porque
 * no hay más de un mes de datos ni fondo de emergencia configurado).
 */
const reglaCategoriaSobreLimite: Regla = (ctx) => {
  const sobre = ctx.presupuesto
    .filter((f) => f.pctUsado !== null && f.pctUsado >= 100)
    .sort((a, b) => (b.pctUsado ?? 0) - (a.pctUsado ?? 0));
  const peor = sobre[0];
  if (!peor) return null;
  const pct = Math.round(peor.pctUsado!);
  return {
    tipo: "warn",
    eyebrow: "Atención",
    numero: `${pct}%`,
    corto: `${peor.categoria.nombre} sobre el límite`,
    largo: `${peor.categoria.nombre} ya superó su límite mensual este mes (${pct}% usado).`,
  };
};

const reglaCategoriaCercaLimite: Regla = (ctx) => {
  const cerca = ctx.presupuesto
    .filter((f) => f.pctUsado !== null && f.pctUsado >= 80 && f.pctUsado < 100)
    .sort((a, b) => (b.pctUsado ?? 0) - (a.pctUsado ?? 0));
  const peor = cerca[0];
  if (!peor) return null;
  const pct = Math.round(peor.pctUsado!);
  return {
    tipo: "warn",
    eyebrow: "Atención",
    numero: `${pct}%`,
    corto: `${peor.categoria.nombre} cerca del límite`,
    largo: `${peor.categoria.nombre} va en ${pct}% de su límite mensual.`,
  };
};

const reglaSinCategorizar: Regla = (ctx) => {
  if (ctx.sinCategorizar <= 0) return null;
  return {
    tipo: "info",
    eyebrow: "Pendiente",
    numero: `S/ ${ctx.sinCategorizar.toFixed(0)}`,
    corto: "sin categorizar este mes",
    largo: `Tienes S/ ${ctx.sinCategorizar.toFixed(2)} en movimientos sin categoría — tócalos en Movimientos para asignarla.`,
  };
};

const reglaTransferenciasInternas: Regla = (ctx) => {
  if (ctx.resumen.transferenciasInternas <= 0) return null;
  return {
    tipo: "good",
    eyebrow: "Transferencias",
    numero: `S/ ${ctx.resumen.transferenciasInternas.toFixed(0)}`,
    corto: "movidos entre tus cuentas",
    largo: `S/ ${ctx.resumen.transferenciasInternas.toFixed(2)} se movieron entre tus propias cuentas este mes — no cuentan como gasto real.`,
  };
};

const reglaGastoDelMes: Regla = (ctx) => {
  if (ctx.resumen.gastos <= 0) return null;
  return {
    tipo: "info",
    eyebrow: "Tu mes",
    numero: `S/ ${ctx.resumen.gastos.toFixed(0)}`,
    corto: "de gasto real",
    largo: `Llevas S/ ${ctx.resumen.gastos.toFixed(2)} de gasto real este mes, sin contar transferencias entre tus cuentas.`,
  };
};

const CATALOGO: Regla[] = [
  reglaCategoriaSobreLimite,
  reglaCategoriaCercaLimite,
  reglaSinCategorizar,
  reglaTransferenciasInternas,
  reglaGastoDelMes,
];

export function evaluarInsights(ctx: ContextoInsights, max = 4): Insight[] {
  const resultados: Insight[] = [];
  for (const regla of CATALOGO) {
    const insight = regla(ctx);
    if (insight) resultados.push(insight);
    if (resultados.length >= max) break;
  }
  return resultados;
}
