import { presupuestoPorCategoria } from "@/db/queries";
import { PresupuestoView } from "./PresupuestoView";

export const dynamic = "force-dynamic";

function mesActual(): string {
  return new Date().toISOString().slice(0, 7);
}

export default async function PresupuestoPage() {
  const { filas, sinCategorizar } = await presupuestoPorCategoria(mesActual());

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-title">Presupuesto</div>
        <div className="screen-sub">Ordenado por qué tan cerca está cada categoría de su límite.</div>
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
        <p className="empty-note">Sin compras en cuotas detectadas este mes.</p>
      </div>
    </div>
  );
}
