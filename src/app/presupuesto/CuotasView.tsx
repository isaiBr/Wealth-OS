"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/Modal";
import { alternarPagoCuotaMesAction, editarCuotasPagadasAction } from "./actions";
import type { CuotaActiva } from "@/db/queries";

const FORMATO = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FORMATO_MES = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" });

const ICONO_CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12l5 5L20 6" />
  </svg>
);

function nombreMes(mesISO: string): string {
  const [anio, mes] = mesISO.split("-").map(Number);
  const nombre = FORMATO_MES.format(new Date(anio, mes - 1, 1));
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

export function CuotasView({ cuotas, totalMensual }: { cuotas: CuotaActiva[]; totalMensual: number }) {
  const [pendientes, setPendientes] = useState<Set<number>>(new Set());
  const [, startTransition] = useTransition();
  const [editando, setEditando] = useState<CuotaActiva | null>(null);
  const [guardando, setGuardando] = useState(false);

  function alternar(c: CuotaActiva) {
    setPendientes((prev) => new Set(prev).add(c.id));
    startTransition(async () => {
      await alternarPagoCuotaMesAction(c.id, c.mesActual, !c.pagadaEsteMes);
      setPendientes((prev) => {
        const copia = new Set(prev);
        copia.delete(c.id);
        return copia;
      });
    });
  }

  async function handleSubmit(formData: FormData) {
    if (!editando) return;
    setGuardando(true);
    try {
      const nuevoTotal = Number(formData.get("cuotasPagadas"));
      await editarCuotasPagadasAction(editando.id, nuevoTotal);
      setEditando(null);
    } finally {
      setGuardando(false);
    }
  }

  if (cuotas.length === 0) {
    return <p className="empty-note">Sin compras en cuotas activas.</p>;
  }

  return (
    <>
      {cuotas.map((c) => {
        const pct = (c.cuotasPagadasTotal / c.totalCuotas) * 100;
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
                {c.cuotasPagadasTotal}/{c.totalCuotas}
              </span>
              <button
                className="edit-btn"
                type="button"
                aria-label={`Corregir cuotas pagadas de ${c.comercio}`}
                title="Corregir cuotas pagadas"
                onClick={() => setEditando(c)}
              >
                ✎
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              <span
                style={{
                  fontSize: 11.5,
                  color: c.pagadaEsteMes ? "var(--accent-strong)" : "var(--ink-muted)",
                }}
              >
                {nombreMes(c.mesActual)}: {c.pagadaEsteMes ? "Pagada" : "Pendiente"}
              </span>
              <button
                className="edit-btn"
                type="button"
                aria-label={
                  c.pagadaEsteMes
                    ? `Deshacer el pago de ${c.comercio} de este mes`
                    : `Marcar cuota de ${c.comercio} como pagada este mes`
                }
                title={c.pagadaEsteMes ? "Deshacer" : "Marcar como pagada"}
                disabled={pendientes.has(c.id)}
                onClick={() => alternar(c)}
              >
                {c.pagadaEsteMes ? "↺" : ICONO_CHECK}
              </button>
            </div>
          </div>
        );
      })}
      <div className="cuota-total">
        <span>Total pendiente este mes</span>
        <span className="valor tabular">S/ {FORMATO.format(totalMensual)}</span>
      </div>

      {editando && (
        <Modal onClose={() => setEditando(null)}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            Corregir cuotas pagadas — {editando.comercio}
          </h2>
          <form action={handleSubmit}>
            <div className="field">
              <label htmlFor="cuotasPagadas">
                Cuotas pagadas de {editando.totalCuotas} totales
              </label>
              <input
                id="cuotasPagadas"
                name="cuotasPagadas"
                type="number"
                min="0"
                max={editando.totalCuotas}
                defaultValue={editando.cuotasPagadasTotal}
                required
              />
            </div>
            <p className="section-sub" style={{ marginTop: 0 }}>
              El estado de &ldquo;{nombreMes(editando.mesActual)}&rdquo; (pagada/pendiente) no se toca acá — usá el
              botón de la fila para eso.
            </p>
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
