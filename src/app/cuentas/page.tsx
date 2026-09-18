import {
  deudaPendiente,
  listarCobranzas,
  listarCuentas,
  listarDeudasManuales,
  obtenerFondoEmergencia,
  saldoCuenta,
} from "@/db/queries";
import { CuentasView } from "./CuentasView";
import { FondoEmergenciaView } from "./FondoEmergenciaView";
import { CobranzasView } from "./CobranzasView";
import { DeudasView } from "./DeudasView";

export const dynamic = "force-dynamic";

export default async function CuentasPage() {
  const cuentas = await listarCuentas();
  const cuentasConSaldo = await Promise.all(
    cuentas.map(async (c) => ({
      id: c.id,
      nombre: c.nombre,
      banco: c.banco,
      tipo: c.tipo,
      destacada: c.destacada,
      billetera: c.billetera,
      saldo: await saldoCuenta(c.id),
    }))
  );
  const fondo = await obtenerFondoEmergencia();
  const deudas = await deudaPendiente();
  const cobranzas = await listarCobranzas();
  const deudasManuales = await listarDeudasManuales();

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-title">Cuentas</div>
        <div className="screen-sub">Saldo reconstruido: saldo inicial + movimientos detectados — no es un pull en vivo del banco.</div>
      </div>
      <div className="dashboard-grid">
        <div className="col-main">
          <CuentasView cuentas={cuentasConSaldo} />
        </div>
        <div className="col-side">
          <FondoEmergenciaView fondo={fondo} cuentas={cuentas.map((c) => ({ id: c.id, nombre: c.nombre }))} />

          <DeudasView deudasTarjeta={deudas} deudasManuales={deudasManuales} />

          <CobranzasView cobranzas={cobranzas} />
        </div>
      </div>
    </div>
  );
}
