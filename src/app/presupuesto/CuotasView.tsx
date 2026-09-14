"use client";

import { useState, useTransition } from "react";
import { marcarCuotaPagadaAction } from "./actions";
import type { CuotaActiva } from "@/db/queries";

const FORMATO = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ICONO_CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12l5 5L20 6" />
  </svg>
);

export function CuotasView({ cuotas, totalMensual }: { cuotas: CuotaActiva[]; totalMensual: number }) {
  const [pendientes, setPendientes] = useState<Set<number>>(new Set());
  const [, startTransition] = useTransition();

  function marcarPagada(id: number) {
    setPendientes((prev) => new Set(prev).add(id));
    startTransition(async () => {
      await marcarCuotaPagadaAction(id);
    });
  }

  if (cuotas.length === 0) {
    return <p className="empty-note">Sin compras en cuotas detectadas este mes.</p>;
  }

  return (
    <>
      {cuotas.map((c) => {
        const pct = (c.cuotasPagadas / c.totalCuotas) * 100;
        return (
          <div className="cuota-row" key={c.id}>
            <div className="cuota-top">
              <span className="comercio">
                {c.comercio} ({c.tarjetaNombre})
              </span>
              <span className="monto tabular">S/ {FORMATO.format(c.montoCuota)}/mes</span>
            </div>
            <div className="cuota-meta">
              <div className="cuota-progress">
                <i style={{ width: `${pct}%` }} />
              </div>
              <span className="n">
                cuota {c.cuotasPagadas + 1}/{c.totalCuotas}
              </span>
              <button
                className="edit-btn"
                type="button"
                aria-label={`Marcar cuota de ${c.comercio} como pagada`}
                disabled={pendientes.has(c.id)}
                onClick={() => marcarPagada(c.id)}
              >
                {ICONO_CHECK}
              </button>
            </div>
          </div>
        );
      })}
      <div className="cuota-total">
        <span>Total en cuotas este mes</span>
        <span className="valor tabular">S/ {FORMATO.format(totalMensual)}</span>
      </div>
    </>
  );
}
