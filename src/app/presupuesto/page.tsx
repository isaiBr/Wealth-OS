import {
  agruparPorBucket,
  cuotasActivas,
  gastoHormigaAnualizado,
  listarComprasCuotas,
  listarMetasCompra,
  presupuestoPorCategoria,
  suscripcionesDelMes,
} from "@/db/queries";
import { PresupuestoView } from "./PresupuestoView";
import { CuotasView } from "./CuotasView";
import { MetasCompraView } from "./MetasCompraView";

export const dynamic = "force-dynamic";

const FORMATO = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BUCKETS: { clave: string; nombre: string; color: string; descripcion: string }[] = [
  { clave: "fijos", nombre: "Costos fijos", color: "var(--ink)", descripcion: "Vivienda, servicios, deudas" },
  { clave: "inversion", nombre: "Inversiones", color: "var(--accent)", descripcion: "Aportes de inversión" },
  { clave: "ahorro", nombre: "Ahorro", color: "var(--cat-3)", descripcion: "Fondo de emergencia y metas" },
  { clave: "libre", nombre: "Gasto libre", color: "var(--warn)", descripcion: "Sin culpa: salidas, gustos, hobbies" },
];

function mesActual(): string {
  return new Date().toISOString().slice(0, 7);
}

export default async function PresupuestoPage() {
  const mes = mesActual();
  const { filas, sinCategorizar } = await presupuestoPorCategoria(mes);
  const { filas: cuotas, totalMensual: totalCuotas } = await cuotasActivas();
  const hormiga = await gastoHormigaAnualizado(mes);
  const suscripciones = await suscripcionesDelMes(mes);
  const metas = await listarMetasCompra();
  const comprasCuotas = await listarComprasCuotas();
  const porBucket = agruparPorBucket(filas);
  const gastoDelMes = filas.reduce((acc, f) => acc + f.gasto, 0);

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-title">Presupuesto</div>
        <div className="screen-sub">Ordenado por qué tan cerca está cada categoría de su límite.</div>
      </div>

      <div className="dashboard-grid">
        <div className="col-main">
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

          <MetasCompraView metas={metas} comprasCuotas={comprasCuotas} />

          <div className="section-head">
            <div className="section-title">Presupuesto por categoría</div>
          </div>
          <PresupuestoView filas={filas} sinCategorizar={sinCategorizar} mes={mes} />
        </div>

        <div className="col-side">
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
            {cuotas.length > 0 && (
              <p className="cuota-note">
                Se marcan pagadas automáticamente al detectar el pago de la tarjeta, o a mano con el check si el
                correo no llega.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
