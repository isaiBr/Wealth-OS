import {
  listarCategorias,
  listarCuentas,
  listarTags,
  resumenMes,
  tagsPorTransaccion,
  transaccionesDelMes,
} from "@/db/queries";
import { MovimientosView } from "./MovimientosView";
import { TabPillsGroup, TabPanel } from "@/components/TabPills";

export const dynamic = "force-dynamic";

function mesActual(): string {
  return new Date().toISOString().slice(0, 7);
}

export default async function MovimientosPage() {
  const mes = mesActual();
  const [cuentas, categorias, transacciones, resumen, tags] = await Promise.all([
    listarCuentas(),
    listarCategorias(),
    transaccionesDelMes(mes, 50, 0),
    resumenMes(mes),
    listarTags(),
  ]);
  const tagsPorTx = await tagsPorTransaccion(transacciones.map((t) => t.id));

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-title">Movimientos</div>
        <div className="screen-sub">Toca un movimiento para editarlo.</div>
      </div>

      <TabPillsGroup
        ariaLabel="Secciones de Movimientos"
        tabs={[
          { key: "lista", label: "Movimientos" },
          { key: "resumen", label: "Resumen" },
        ]}
      >
        <div className="dashboard-grid">
          <div className="col-main">
            <TabPanel tabKey="lista">
              <MovimientosView
                cuentas={cuentas}
                categorias={categorias}
                transacciones={transacciones}
                tags={tags}
                tagsPorTxInicial={tagsPorTx}
                mes={mes}
              />
            </TabPanel>
          </div>

          <div className="col-side">
            <TabPanel tabKey="resumen">
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
            </TabPanel>
          </div>
        </div>
      </TabPillsGroup>
    </div>
  );
}
