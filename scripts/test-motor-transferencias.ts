import { detectarTransferenciasInternas } from "../src/logic/motor-transferencias";
import type { Transaccion } from "../src/db/queries";

function tx(overrides: Partial<Transaccion>): Transaccion {
  return {
    id: 0,
    cuentaId: 1,
    tipo: "compra",
    monto: 100,
    moneda: "PEN",
    comercio: null,
    descripcion: null,
    fecha: "2026-09-01T10:00:00",
    numeroOperacion: null,
    categoriaId: null,
    categoriaConfirmada: false,
    esTransferenciaInterna: false,
    cuentaDestinoId: null,
    excluida: false,
    fuente: "email",
    correoRaw: null,
    gmailMessageId: null,
    createdAt: "",
    ...overrides,
  };
}

function assert(cond: boolean, mensaje: string) {
  console.log(cond ? "OK  " : "FAIL", mensaje);
  if (!cond) process.exitCode = 1;
}

// Caso 1: match claro — sale de cuenta 1, entra a cuenta 2, mismo monto, 10 min después.
const salida1 = tx({ id: 1, cuentaId: 1, tipo: "transferencia", monto: 250, fecha: "2026-09-01T10:00:00" });
const entrada1 = tx({ id: 2, cuentaId: 2, tipo: "ingreso", monto: 250, fecha: "2026-09-01T10:10:00" });

// Caso 2: NO debe matchear — mismo monto pero en la MISMA cuenta.
const salida2 = tx({ id: 3, cuentaId: 3, tipo: "compra", monto: 50, fecha: "2026-09-02T09:00:00" });
const entrada2 = tx({ id: 4, cuentaId: 3, tipo: "ingreso", monto: 50, fecha: "2026-09-02T09:05:00" });

// Caso 3: NO debe matchear — mismo monto, cuentas distintas, pero 3 días de diferencia.
const salida3 = tx({ id: 5, cuentaId: 4, tipo: "compra", monto: 80, fecha: "2026-09-01T00:00:00" });
const entrada3 = tx({ id: 6, cuentaId: 5, tipo: "ingreso", monto: 80, fecha: "2026-09-04T00:00:00" });

// Caso 4: NO debe matchear — ya viene marcada como transferencia interna (otro mecanismo ya la resolvió).
const salida4 = tx({ id: 7, cuentaId: 6, tipo: "transferencia", monto: 30, fecha: "2026-09-01T00:00:00", esTransferenciaInterna: true });
const entrada4 = tx({ id: 8, cuentaId: 7, tipo: "ingreso", monto: 30, fecha: "2026-09-01T00:05:00" });

const resultado = detectarTransferenciasInternas([
  salida1, entrada1, salida2, entrada2, salida3, entrada3, salida4, entrada4,
]);

assert(resultado.length === 1, `debería encontrar exactamente 1 match, encontró ${resultado.length}`);
assert(resultado[0]?.salida.id === 1 && resultado[0]?.entrada.id === 2, "el match encontrado debe ser el caso 1");
