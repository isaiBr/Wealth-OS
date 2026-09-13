import { listarCategorias, listarCuentas, resumenMes, transaccionesDelMes } from "@/db/queries";
import { MovimientosView } from "./MovimientosView";

export const dynamic = "force-dynamic";

function mesActual(): string {
  return new Date().toISOString().slice(0, 7);
}

export default async function MovimientosPage() {
  const mes = mesActual();
  const [cuentas, categorias, transacciones, resumen] = await Promise.all([
    listarCuentas(),
    listarCategorias(),
    transaccionesDelMes(mes),
    resumenMes(mes),
  ]);

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-title">Movimientos</div>
        <div className="screen-sub">Toca un movimiento para editarlo.</div>
      </div>

      <div className="dashboard-grid">
        <div className="col-main">
          <MovimientosView cuentas={cuentas} categorias={categorias} transacciones={transacciones} />
        </div>

        <div className="col-side">
          <div className="section-head">
            <div className="section-title">Resumen del mes</div>
          </div>
          <div className="card" style={{ padding: "6px 18px" }}>
            <div className="summary-row">
              <span>Ingresos</span>
              <span className="valor tabular income">S/ {resumen.ingresos.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Gastos</span>
              <span className="valor tabular">S/ {resumen.gastos.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Transferencias internas</span>
              <span className="valor tabular">S/ {resumen.transferenciasInternas.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
