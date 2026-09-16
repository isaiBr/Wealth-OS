/**
 * "Mensajitos" de comparación vs. el mes anterior para las 4 cards de "mi
 * mes en números" del mockup (ver dashboard-mockup-v2.html) — igual que el
 * motor de insights (roadmap §11), es lógica de negocio sobre datos ya
 * calculados, no IA.
 */
export type SentidoDelta = "mayorEsMejor" | "mayorEsPeor";

export interface Delta {
  texto: string;
  clase: "up-good" | "up-warn" | "flat";
}

function clasificar(delta: number, sentido: SentidoDelta, umbralFlat: number): Delta["clase"] {
  if (Math.abs(delta) < umbralFlat) return "flat";
  const esBueno = sentido === "mayorEsMejor" ? delta > 0 : delta < 0;
  return esBueno ? "up-good" : "up-warn";
}

/** Para montos en soles — cualquier diferencia no nula ya cuenta como movimiento real. */
export function deltaMonto(actual: number, anterior: number, sentido: SentidoDelta, nombreMesAnterior: string): Delta {
  const delta = actual - anterior;
  const signo = delta >= 0 ? "+" : "−";
  return {
    texto: `${signo} S/ ${Math.abs(delta).toFixed(0)} vs. ${nombreMesAnterior}`,
    clase: clasificar(delta, sentido, 1),
  };
}

/** Para porcentajes (tasa de ahorro, % de gastos fijos) — un par de puntos de ruido no es tendencia. */
export function deltaPuntos(actual: number, anterior: number, sentido: SentidoDelta, nombreMesAnterior: string): Delta {
  const delta = Math.round(actual) - Math.round(anterior);
  const signo = delta >= 0 ? "+" : "−";
  const unidad = Math.abs(delta) === 1 ? "pt" : "pts";
  return {
    texto: `${signo} ${Math.abs(delta)} ${unidad} vs. ${nombreMesAnterior}`,
    clase: clasificar(delta, sentido, 2),
  };
}
