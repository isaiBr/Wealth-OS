import type { Transaccion } from "@/db/queries";

export interface MatchTransferencia {
  salida: Transaccion;
  entrada: Transaccion;
}

const VENTANA_HORAS = 24;
const TOLERANCIA_MONTO = 0.01;

/**
 * Motor de matching del roadmap §4: un débito en una cuenta + un crédito en
 * otra cuenta tuya, mismo monto y fecha/hora cercana, es una transferencia
 * interna aunque el banco no la etiquete como tal.
 *
 * Complementa (no reemplaza) los casos ya resueltos con certeza en la
 * ingesta: BCP marca "Transferencia entre mis cuentas" explícito, y el
 * heurístico de nombre propio (src/logic/transferencia-interna.ts) cubre
 * pagos a ti mismo por Yape/Plin. Este motor es para cuando ninguna de esas
 * dos señales está disponible pero SÍ existe la fila de "ingreso" del lado
 * que recibió — algo que hoy es raro (los bancos casi nunca envían correo
 * por dinero entrante), pero que se vuelve más común según se agreguen
 * ingresos manuales o nuevos bancos.
 *
 * Es lógica pura (sin acceso a DB) para que sea fácil de probar — ver
 * scripts/test-motor-transferencias.ts.
 */
export function detectarTransferenciasInternas(transacciones: Transaccion[]): MatchTransferencia[] {
  const entradas = transacciones.filter((t) => t.tipo === "ingreso" && !t.esTransferenciaInterna);
  const salidas = transacciones.filter(
    (t) => t.tipo !== "ingreso" && t.tipo !== "devolucion" && !t.esTransferenciaInterna
  );

  const usadas = new Set<number>();
  const matches: MatchTransferencia[] = [];

  for (const entrada of entradas) {
    let mejor: Transaccion | null = null;
    let mejorDiffHoras = Infinity;

    for (const salida of salidas) {
      if (usadas.has(salida.id)) continue;
      if (salida.cuentaId === entrada.cuentaId) continue; // tiene que ser otra cuenta

      if (Math.abs(salida.monto - entrada.monto) > TOLERANCIA_MONTO) continue;

      const diffHoras = Math.abs(new Date(salida.fecha).getTime() - new Date(entrada.fecha).getTime()) / 3_600_000;
      if (diffHoras > VENTANA_HORAS) continue;

      if (diffHoras < mejorDiffHoras) {
        mejorDiffHoras = diffHoras;
        mejor = salida;
      }
    }

    if (mejor) {
      usadas.add(mejor.id);
      matches.push({ salida: mejor, entrada });
    }
  }

  return matches;
}
