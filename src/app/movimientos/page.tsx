import {
  listarCategorias,
  listarCuentas,
  listarTags,
  resumenMes,
  tagsPorTransaccion,
  transaccionesDelMes,
  type FiltrosMovimientos,
} from "@/db/queries";
import { MovimientosView } from "./MovimientosView";
import { MesSelector } from "@/components/MesSelector";
import { MovimientosFiltros } from "@/components/MovimientosFiltros";
import { TabPillsGroup, TabPanel } from "@/components/TabPills";
import { FiltrosToggleProvider, FiltrosToggleBoton, FiltrosToggleContenido } from "@/components/FiltrosToggle";
import { normalizarMes } from "@/logic/mes";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ mes?: string; categoriaId?: string; tagId?: string; q?: string }>;
}

export default async function MovimientosPage({ searchParams }: Props) {
  const params = await searchParams;
  const mes = normalizarMes(params.mes);
  const filtros: FiltrosMovimientos = {
    categoriaId: params.categoriaId ? Number(params.categoriaId) : undefined,
    tagId: params.tagId ? Number(params.tagId) : undefined,
    texto: params.q || undefined,
  };

  const [cuentas, categorias, transacciones, resumen, tags] = await Promise.all([
    listarCuentas(),
    listarCategorias(),
    transaccionesDelMes(mes, 50, 0, filtros),
    resumenMes(mes),
    listarTags(),
  ]);
  const tagsPorTx = await tagsPorTransaccion(transacciones.map((t) => t.id));

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head-row">
          <div className="screen-title">Movimientos</div>
          <MesSelector mes={mes} basePath="/movimientos" paramsActuales={params as Record<string, string | undefined>} />
        </div>
        <div className="screen-sub">Toca un movimiento para editarlo.</div>
      </div>

      <FiltrosToggleProvider abiertoInicial={Boolean(filtros.categoriaId || filtros.tagId || filtros.texto)}>
        <TabPillsGroup
          ariaLabel="Secciones de Movimientos"
          tabs={[
            { key: "lista", label: "Movimientos" },
            { key: "resumen", label: "Resumen" },
          ]}
          extra={<FiltrosToggleBoton />}
        >
          <div className="dashboard-grid">
            <div className="col-main">
              <TabPanel tabKey="lista">
                <FiltrosToggleContenido>
                  <MovimientosFiltros categorias={categorias} tags={tags} />
                </FiltrosToggleContenido>
                <MovimientosView
                  cuentas={cuentas}
                  categorias={categorias}
                  transacciones={transacciones}
                  tags={tags}
                  tagsPorTxInicial={tagsPorTx}
                  mes={mes}
                  filtros={filtros}
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
      </FiltrosToggleProvider>
    </div>
  );
}
