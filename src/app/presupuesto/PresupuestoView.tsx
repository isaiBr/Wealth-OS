"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { editarLimiteAction } from "./actions";
import type { FilaPresupuesto } from "@/db/queries";

const FORMATO = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ICONO_ALERTA = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
    <path d="M12 9v4M12 17h.01M10.3 3.9 2.7 17.1a1.8 1.8 0 0 0 1.6 2.7h15.4a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" />
  </svg>
);

function estadoBarra(pct: number | null): "" | "warn" | "over" {
  if (pct === null) return "";
  if (pct >= 100) return "over";
  if (pct >= 80) return "warn";
  return "";
}

export function PresupuestoView({ filas, sinCategorizar }: { filas: FilaPresupuesto[]; sinCategorizar: number }) {
  const [editando, setEditando] = useState<FilaPresupuesto | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(formData: FormData) {
    setGuardando(true);
    try {
      await editarLimiteAction(formData);
      setEditando(null);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="card">
        {filas.map(({ categoria, gasto, pctUsado, sinMovimiento }) => {
          const estado = estadoBarra(pctUsado);
          return (
            <div className={`cat-row${sinMovimiento ? " zero" : ""}`} key={categoria.id}>
              <div className="cat-top">
                <span>{categoria.nombre}</span>
                <span className="row-right">
                  <span className="cifras">
                    <strong className="tabular">S/ {FORMATO.format(gasto)}</strong>
                    {categoria.limiteMensual ? ` / S/ ${FORMATO.format(categoria.limiteMensual)}` : ""}
                  </span>
                  <button className="edit-btn" type="button" onClick={() => setEditando({ categoria, gasto, pctUsado, sinMovimiento })} aria-label={`Editar límite de ${categoria.nombre}`}>
                    ✎
                  </button>
                </span>
              </div>
              {!sinMovimiento && categoria.limiteMensual !== null && (
                <div className="cat-bar-track">
                  <div
                    className={`cat-bar-fill ${estado}`}
                    style={{ width: `${Math.min(100, pctUsado ?? 0)}%` }}
                  />
                </div>
              )}
              {estado === "over" && categoria.limiteMensual !== null && (
                <div className="cat-flag over">
                  {ICONO_ALERTA}
                  S/ {FORMATO.format(gasto - categoria.limiteMensual)} sobre el presupuesto
                </div>
              )}
              {estado === "warn" && <div className="cat-flag warn">{ICONO_ALERTA}Cerca del límite</div>}
              {sinMovimiento && <div className="cat-zero-note">Sin movimiento este mes</div>}
            </div>
          );
        })}
        {sinCategorizar > 0 && (
          <div className="cat-row zero">
            <div className="cat-top">
              <span>Sin categorizar</span>
              <span className="cifras">
                <strong className="tabular">S/ {FORMATO.format(sinCategorizar)}</strong>
              </span>
            </div>
            <div className="cat-zero-note">
              Movimientos sin categoría asignada — asígnala desde Movimientos tocando cada uno.
            </div>
          </div>
        )}
      </div>

      {editando && (
        <Modal onClose={() => setEditando(null)}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            Límite mensual — {editando.categoria.nombre}
          </h2>
          <form action={handleSubmit}>
            <input type="hidden" name="categoriaId" value={editando.categoria.id} />
            <div className="field">
              <label htmlFor="limiteMensual">Límite (S/) — vacío para quitarlo</label>
              <input
                id="limiteMensual"
                name="limiteMensual"
                type="number"
                step="0.01"
                min="0"
                defaultValue={editando.categoria.limiteMensual ?? ""}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditando(null)} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
