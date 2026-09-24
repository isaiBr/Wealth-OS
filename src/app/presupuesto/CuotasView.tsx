"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/Modal";
import { alternarPagoCuotaMesAction, editarCuotasPagadasAction, crearCompraCuotasAction } from "./actions";
import type { CuotaActiva, Tarjeta } from "@/db/queries";

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

export function CuotasView({
  cuotas,
  totalMensual,
  tarjetas,
}: {
  cuotas: CuotaActiva[];
  totalMensual: number;
  tarjetas: Tarjeta[];
}) {
  const [pendientes, setPendientes] = useState<Set<number>>(new Set());
  const [, startTransition] = useTransition();
  const [editando, setEditando] = useState<CuotaActiva | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [creando, setCreando] = useState(false);

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
      const nuevoComercio = String(formData.get("comercio") ?? "");
      await editarCuotasPagadasAction(editando.id, nuevoTotal, nuevoComercio);
      setEditando(null);
    } finally {
      setGuardando(false);
    }
  }

  async function handleCrear(formData: FormData) {
    setCreando(true);
    try {
      await crearCompraCuotasAction(formData);
      setAgregando(false);
    } finally {
      setCreando(false);
    }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: cuotas.length > 0 ? 12 : 8 }}>
        <button type="button" className="text-link" onClick={() => setAgregando(true)}>
          + Agregar compra en cuotas
        </button>
      </div>

      {cuotas.length === 0 && <p className="empty-note">Sin compras en cuotas activas.</p>}

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
      {cuotas.length > 0 && (
        <div className="cuota-total">
          <span>Total pendiente este mes</span>
          <span className="valor tabular">S/ {FORMATO.format(totalMensual)}</span>
        </div>
      )}

      {editando && (
        <Modal onClose={() => setEditando(null)}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            Corregir cuotas pagadas — {editando.comercio}
          </h2>
          <form action={handleSubmit}>
            <div className="field">
              <label htmlFor="comercio">Nombre de la cuota</label>
              <input id="comercio" name="comercio" type="text" defaultValue={editando.comercio} required />
            </div>
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

      {agregando && (
        <Modal onClose={() => setAgregando(false)}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            Agregar compra en cuotas
          </h2>
          <form action={handleCrear}>
            <div className="field">
              <label htmlFor="tarjetaId">Tarjeta</label>
              <select id="tarjetaId" name="tarjetaId" required defaultValue="">
                <option value="" disabled>
                  Selecciona una tarjeta
                </option>
                {tarjetas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="comercio-nuevo">Comercio</label>
              <input id="comercio-nuevo" name="comercio" type="text" placeholder="Ripley" required />
            </div>
            <div className="field">
              <label htmlFor="montoTotal">Monto total (S/)</label>
              <input id="montoTotal" name="montoTotal" type="number" step="0.01" min="0.01" required />
            </div>
            <div className="field">
              <label htmlFor="totalCuotas">Cantidad de cuotas</label>
              <input id="totalCuotas" name="totalCuotas" type="number" min="1" step="1" required />
            </div>
            <div className="field">
              <label htmlFor="fechaCompra">Fecha de la compra</label>
              <input
                id="fechaCompra"
                name="fechaCompra"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
            <p className="section-sub" style={{ marginTop: 0 }}>
              El monto de cada cuota se calcula solo (monto total ÷ cantidad de cuotas).
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setAgregando(false)} disabled={creando}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={creando}>
                {creando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
