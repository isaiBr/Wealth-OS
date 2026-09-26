import {
  agruparPorBucket,
  cuotasActivas,
  gastoHormigaAnualizado,
  listarMetasCompra,
  presupuestoPorCategoria,
  suscripcionesDelMes,
} from "@/db/queries";
import { PresupuestoView } from "./PresupuestoView";
import { CuotasView } from "./CuotasView";
import { MetasCompraView } from "./MetasCompraView";
import { TabPillsGroup, TabPanel } from "@/components/TabPills";
import { MesSelector } from "@/components/MesSelector";
import { normalizarMes } from "@/logic/mes";

export const dynamic = "force-dynamic";

const FORMATO = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BUCKETS: { clave: string; nombre: string; color: string; descripcion: string }[] = [
  { clave: "fijos", nombre: "Costos fijos", color: "var(--ink)", descripcion: "Vivienda, servicios, deudas" },
  { clave: "inversion", nombre: "Inversiones", color: "var(--accent)", descripcion: "Aportes de inversión" },
  { clave: "ahorro", nombre: "Ahorro", color: "var(--cat-3)", descripcion: "Fondo de emergencia y metas" },
  { clave: "libre", nombre: "Gasto libre", color: "var(--warn)", descripcion: "Sin culpa: salidas, gustos, hobbies" },
];

interface Props {
  searchParams: Promise<{ mes?: string; tab?: string }>;
}

export default async function PresupuestoPage({ searchParams }: Props) {
  const params = await searchParams;
  const mes = normalizarMes(params.mes);
  const { filas, sinCategorizar } = await presupuestoPorCategoria(mes);
  const { filas: cuotas, totalMensual: totalCuotas } = await cuotasActivas();
  const hormiga = await gastoHormigaAnualizado(mes);
  const suscripciones = await suscripcionesDelMes(mes);
  const metas = await listarMetasCompra();
  const porBucket = agruparPorBucket(filas);
  const gastoDelMes = filas.reduce((acc, f) => acc + f.gasto, 0);

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head-row">
          <div className="screen-title">Presupuesto</div>
          <MesSelector mes={mes} basePath="/presupuesto" paramsActuales={params as Record<string, string | undefined>} />
        </div>
        <div className="screen-sub">Ordenado por qué tan cerca está cada categoría de su límite.</div>
      </div>

      <TabPillsGroup
        ariaLabel="Secciones de Presupuesto"
        tabs={[
          { key: "categorias", label: "Categorías" },
          { key: "plan", label: "Plan" },
          { key: "metas", label: "Metas" },
          { key: "extras", label: "Extras" },
        ]}
        initialTab={params.tab}
      >
        <TabPanel tabKey="plan">
          <div className="section-head">
            <div className="section-title">Plan de gasto consciente</div>
          </div>
          <div className="card">
            {BUCKETS.map((b) => {
              const monto = porBucket[b.clave] ?? 0;
              const pct = gastoDelMes > 0 ? (monto / gastoDelMes) * 100 : 0;
              return (
                <div className="plan-row" key={b.clave}>
                  <span className="dot" style={{ background: b.color }} />
                  <div className="info">
                    <div className="nombre">{b.nombre}</div>
                    <div className="meta">{b.descripcion}</div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: b.color }} />
                    </div>
                  </div>
                  <div className="pct tabular">{pct.toFixed(0)}%</div>
                </div>
              );
            })}
          </div>
        </TabPanel>

        <TabPanel tabKey="metas">
          <MetasCompraView metas={metas} />
        </TabPanel>

        <TabPanel tabKey="categorias">
          <div className="section-head">
            <div className="section-title">Presupuesto por categoría</div>
          </div>
          <PresupuestoView filas={filas} sinCategorizar={sinCategorizar} mes={mes} />
        </TabPanel>

        <TabPanel tabKey="extras">
          {hormiga.totalMes > 0 && (
            <>
              <div className="section-head">
                <div>
                  <div className="section-title">Gasto hormiga anualizado</div>
                  <div className="section-sub">Lo chico también cuenta — proyectado a 12 meses</div>
                </div>
              </div>
              <div className="card">
                <div className="hormiga-list">
                  {hormiga.porCategoria.slice(0, 5).map((h) => (
                    <div className="hormiga-row" key={h.nombre}>
                      <span className="n">{h.nombre}</span>
                      <span className="tabular">S/ {FORMATO.format(h.monto)}</span>
                    </div>
                  ))}
                </div>
                <div className="hormiga-total">
                  <span className="label">Total este mes</span>
                  <span className="valor tabular">S/ {FORMATO.format(hormiga.totalMes)}</span>
                </div>
                <div className="hormiga-annual">
                  <b className="tabular">S/ {FORMATO.format(hormiga.proyeccionAnual)} / año</b>
                  si mantienes este ritmo en compras menores a S/ 20.
                </div>
              </div>
            </>
          )}

          <div className="section-head">
            <div>
              <div className="section-title">Suscripciones</div>
              <div className="section-sub">Movimientos con categoría o etiqueta &ldquo;Suscripciones&rdquo; este mes</div>
            </div>
          </div>
          <div className="card">
            {suscripciones.filas.length === 0 ? (
              <p className="empty-note">
                Ninguna este mes — asignale la categoría o una etiqueta &ldquo;Suscripciones&rdquo; a un movimiento
                en Movimientos para que aparezca acá.
              </p>
            ) : (
              <>
                <div className="hormiga-list">
                  {suscripciones.filas.map((s) => (
                    <div className="hormiga-row" key={s.nombre}>
                      <span className="n">{s.nombre}</span>
                      <span className="tabular">S/ {FORMATO.format(s.monto)}</span>
                    </div>
                  ))}
                </div>
                <div className="hormiga-total">
                  <span className="label">Total este mes</span>
                  <span className="valor tabular">S/ {FORMATO.format(suscripciones.total)}</span>
                </div>
              </>
            )}
          </div>

          <div className="section-head">
            <div className="section-title">Cuotas activas</div>
          </div>
          <div className="card">
            <CuotasView cuotas={cuotas} totalMensual={totalCuotas} />
          </div>
        </TabPanel>
      </TabPillsGroup>
    </div>
  );
}
