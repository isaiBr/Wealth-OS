import { agruparPorBucket, cuotasActivas, presupuestoPorCategoria } from "@/db/queries";
import { PresupuestoView } from "./PresupuestoView";

export const dynamic = "force-dynamic";

const FORMATO = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BUCKETS: { clave: string; nombre: string; color: string }[] = [
  { clave: "fijos", nombre: "Costos fijos", color: "var(--ink)" },
  { clave: "inversion", nombre: "Inversiones", color: "var(--accent)" },
  { clave: "ahorro", nombre: "Ahorro", color: "var(--cat-3)" },
  { clave: "libre", nombre: "Gasto libre", color: "var(--warn)" },
];

function mesActual(): string {
  return new Date().toISOString().slice(0, 7);
}

export default async function PresupuestoPage() {
  const { filas, sinCategorizar } = await presupuestoPorCategoria(mesActual());
  const { filas: cuotas, totalMensual: totalCuotas } = await cuotasActivas();
  const porBucket = agruparPorBucket(filas);
  const gastoDelMes = filas.reduce((acc, f) => acc + f.gasto, 0);

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-title">Presupuesto</div>
        <div className="screen-sub">Ordenado por qué tan cerca está cada categoría de su límite.</div>
      </div>

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
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: b.color }} />
                </div>
              </div>
              <div className="pct tabular">S/ {FORMATO.format(monto)}</div>
            </div>
          );
        })}
      </div>

      <div className="section-head">
        <div className="section-title">Presupuesto por categoría</div>
      </div>
      <PresupuestoView filas={filas} sinCategorizar={sinCategorizar} />

      <div className="section-head">
        <div className="section-title">Suscripciones</div>
      </div>
      <div className="card">
        <p className="empty-note">
          Todavía no se detectó ninguna — se sugieren solas cuando un mismo comercio y monto se repita ~mensualmente
          (roadmap §8). Necesita al menos 2 meses de historial para detectar el patrón.
        </p>
      </div>

      <div className="section-head">
        <div className="section-title">Cuotas activas</div>
      </div>
      <div className="card">
        {cuotas.length === 0 ? (
          <p className="empty-note">Sin compras en cuotas detectadas este mes.</p>
        ) : (
          <>
            {cuotas.map((c) => {
              const pct = (c.cuotasPagadas / c.totalCuotas) * 100;
              return (
                <div className="cuota-row" key={c.id}>
                  <div className="cuota-top">
                    <span className="comercio">{c.comercio}</span>
                    <span className="monto tabular">S/ {FORMATO.format(c.montoCuota)}/mes</span>
                  </div>
                  <div className="cuota-meta">
                    <div className="cuota-progress">
                      <i style={{ width: `${pct}%` }} />
                    </div>
                    <span className="n">
                      cuota {c.cuotasPagadas + 1}/{c.totalCuotas}
                    </span>
                  </div>
                </div>
              );
            })}
            <div className="cuota-total">
              <span>Total en cuotas este mes</span>
              <span className="valor tabular">S/ {FORMATO.format(totalCuotas)}</span>
            </div>
            <p className="cuota-note">
              Se marcan pagadas automáticamente al detectar el pago de la tarjeta, o a mano si el correo no llega
              (todavía no implementado).
            </p>
          </>
        )}
      </div>
    </div>
  );
}
