import { deudaPendiente, listarCuentas, obtenerFondoEmergencia, saldoCuenta } from "@/db/queries";
import { CuentasView } from "./CuentasView";
import { FondoEmergenciaView } from "./FondoEmergenciaView";

export const dynamic = "force-dynamic";

const FORMATO = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

          <div className="section-head">
            <div className="section-title">Deudas</div>
          </div>
          <div className="card debt-card">
            {deudas.length === 0 ? (
              <p className="empty-note">Sin deudas pendientes.</p>
            ) : (
              deudas.map((d, i) => (
                <div key={d.cuenta.id} style={i > 0 ? { marginTop: 16, paddingTop: 16, borderTop: "1px dashed var(--border)" } : undefined}>
                  <div className="debt-head">
                    <span className="debt-name">{d.cuenta.nombre}</span>
                  </div>
                  <div className="debt-meta">
                    <span>Pendiente</span>
                    <span className="tabular">S/ {FORMATO.format(d.saldo)}</span>
                  </div>
                  {d.fechaVencimiento && (
                    <div className="debt-due">
                      Próximo pago: <b>{d.fechaVencimiento}</b>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
