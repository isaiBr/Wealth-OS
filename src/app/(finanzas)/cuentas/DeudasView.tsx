"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import {
  crearDeudaManualAction,
  editarMontoDeudaManualAction,
  marcarDeudaManualPagadaAction,
  eliminarDeudaManualAction,
  corregirDeudaTarjetaAction,
} from "./actions";
import type { DeudaManual, DeudaPendiente } from "@/db/queries";

const FORMATO = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  deudasTarjeta: DeudaPendiente[];
  deudasManuales: DeudaManual[];
}

export function DeudasView({ deudasTarjeta, deudasManuales }: Props) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoTarjeta, setEditandoTarjeta] = useState<DeudaPendiente | null>(null);
  const [editandoManual, setEditandoManual] = useState<DeudaManual | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  const manualesPendientes = deudasManuales.filter((d) => d.estado === "pendiente");
  const manualesPagadas = deudasManuales.filter((d) => d.estado === "pagada");
  const totalPendiente =
    deudasTarjeta.reduce((acc, d) => acc + d.saldo, 0) + manualesPendientes.reduce((acc, d) => acc + d.montoAdeudado, 0);
  const sinDeudas = deudasTarjeta.length === 0 && manualesPendientes.length === 0;

  async function handleCrear(formData: FormData) {
    setGuardando(true);
    try {
      await crearDeudaManualAction(formData);
      setModalAbierto(false);
    } finally {
      setGuardando(false);
    }
  }

  async function handleEditarTarjeta(formData: FormData) {
    if (!editandoTarjeta) return;
    setGuardando(true);
    try {
      const monto = parseFloat(String(formData.get("monto") ?? ""));
      await corregirDeudaTarjetaAction(editandoTarjeta.cuenta.id, monto);
      setEditandoTarjeta(null);
    } finally {
      setGuardando(false);
    }
  }

  async function handleEditarManual(formData: FormData) {
    if (!editandoManual) return;
    setGuardando(true);
    try {
      const monto = parseFloat(String(formData.get("monto") ?? ""));
      await editarMontoDeudaManualAction(editandoManual.id, monto);
      setEditandoManual(null);
    } finally {
      setGuardando(false);
    }
  }

  async function handleToggle(d: DeudaManual) {
    setProcesandoId(`m-${d.id}`);
    try {
      await marcarDeudaManualPagadaAction(d.id, d.estado !== "pagada");
    } finally {
      setProcesandoId(null);
    }
  }

  async function handleEliminar(d: DeudaManual) {
    setProcesandoId(`m-${d.id}`);
    try {
      await eliminarDeudaManualAction(d.id);
    } finally {
      setProcesandoId(null);
    }
  }

  return (
    <>
      <div className="section-head">
        <div>
          <div className="section-title">Deudas</div>
          <div className="section-sub">De tus tarjetas de crédito (automático) + las que agregues a mano</div>
        </div>
        <button className="text-link" type="button" onClick={() => setModalAbierto(true)}>
          + Agregar deuda
        </button>
      </div>
      <div className="card debt-card">
        {sinDeudas ? (
          <p className="empty-note">Sin deudas pendientes.</p>
        ) : (
          <>
            {deudasTarjeta.map((d, i) => (
              <div
                key={`t-${d.cuenta.id}`}
                style={i > 0 ? { marginTop: 16, paddingTop: 16, borderTop: "1px dashed var(--border)" } : undefined}
              >
                <div className="debt-head">
                  <span className="debt-name">{d.cuenta.nombre}</span>
                </div>
                <div className="debt-bar-track">
                  <div className="debt-bar-fill" style={{ width: "100%" }} />
                </div>
                <div className="debt-meta">
                  <span>Pendiente</span>
                  <span className="row-right">
                    <span className="tabular">S/ {FORMATO.format(d.saldo)}</span>
                    <button
                      type="button"
                      className="edit-btn"
                      aria-label={`Corregir deuda de ${d.cuenta.nombre}`}
                      title="Corregir monto"
                      onClick={() => setEditandoTarjeta(d)}
                    >
                      ✎
                    </button>
                  </span>
                </div>
                {d.fechaVencimiento && (
                  <div className="debt-due">
                    Próximo pago: <b>{d.fechaVencimiento}</b>
                  </div>
                )}
              </div>
            ))}
            {manualesPendientes.map((d, i) => (
              <div
                key={`m-${d.id}`}
                style={
                  deudasTarjeta.length > 0 || i > 0
                    ? { marginTop: 16, paddingTop: 16, borderTop: "1px dashed var(--border)" }
                    : undefined
                }
              >
                <div className="debt-head">
                  <span className="debt-name">{d.descripcion}</span>
                </div>
                <div className="debt-bar-track">
                  <div className="debt-bar-fill" style={{ width: "100%" }} />
                </div>
                <div className="debt-meta">
                  <span>Pendiente</span>
                  <span className="row-right">
                    <span className="tabular">S/ {FORMATO.format(d.montoAdeudado)}</span>
                    <button
                      type="button"
                      className="edit-btn"
                      aria-label={`Corregir monto de ${d.descripcion}`}
                      title="Corregir monto"
                      onClick={() => setEditandoManual(d)}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="edit-btn"
                      aria-label={`Marcar "${d.descripcion}" como pagada`}
                      title="Marcar como pagada"
                      disabled={procesandoId === `m-${d.id}`}
                      onClick={() => handleToggle(d)}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      className="edit-btn"
                      aria-label={`Eliminar deuda "${d.descripcion}"`}
                      title="Eliminar"
                      disabled={procesandoId === `m-${d.id}`}
                      onClick={() => handleEliminar(d)}
                    >
                      ✕
                    </button>
                  </span>
                </div>
              </div>
            ))}
            <div className="debt-meta" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--border)" }}>
              <span>Total pendiente</span>
              <span className="tabular">S/ {FORMATO.format(totalPendiente)}</span>
            </div>
          </>
        )}

        {manualesPagadas.length > 0 && (
          <details style={{ marginTop: 14 }}>
            <summary style={{ fontSize: 11.5, color: "var(--ink-faint)", cursor: "pointer" }}>
              Ya pagadas ({manualesPagadas.length})
            </summary>
            <div style={{ marginTop: 8 }}>
              {manualesPagadas.map((d) => (
                <div className="cuenta" key={d.id} style={{ marginTop: 8, opacity: 0.6 }}>
                  <div className="cuenta-info" style={{ minWidth: 0 }}>
                    <div className="nombre-cuenta" style={{ color: "var(--ink)", textDecoration: "line-through" }}>
                      {d.descripcion}
                    </div>
                  </div>
                  <div className="row-right">
                    <div className="saldo tabular">S/ {FORMATO.format(d.montoAdeudado)}</div>
                    <button
                      type="button"
                      className="edit-btn"
                      aria-label={`Revertir deuda "${d.descripcion}"`}
                      title="Marcar como pendiente de nuevo"
                      disabled={procesandoId === `m-${d.id}`}
                      onClick={() => handleToggle(d)}
                    >
                      ↺
                    </button>
                    <button
                      type="button"
                      className="edit-btn"
                      aria-label={`Eliminar deuda "${d.descripcion}"`}
                      title="Eliminar"
                      disabled={procesandoId === `m-${d.id}`}
                      onClick={() => handleEliminar(d)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {modalAbierto && (
        <Modal onClose={() => setModalAbierto(false)}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            Agregar deuda
          </h2>
          <form action={handleCrear}>
            <div className="field">
              <label htmlFor="descripcion">Descripción</label>
              <input id="descripcion" name="descripcion" type="text" placeholder="Préstamo de mi papá" required />
            </div>
            <div className="field">
              <label htmlFor="montoAdeudado">Monto adeudado (S/)</label>
              <input id="montoAdeudado" name="montoAdeudado" type="number" step="0.01" min="0.01" required />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setModalAbierto(false)} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editandoTarjeta && (
        <Modal onClose={() => setEditandoTarjeta(null)}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            Corregir deuda — {editandoTarjeta.cuenta.nombre}
          </h2>
          <form action={handleEditarTarjeta}>
            <div className="field">
              <label htmlFor="monto-tarjeta">Monto pendiente (S/)</label>
              <input
                id="monto-tarjeta"
                name="monto"
                type="number"
                step="0.01"
                min="0"
                defaultValue={editandoTarjeta.saldo.toFixed(2)}
                required
              />
            </div>
            <p className="section-sub" style={{ marginTop: 0 }}>
              Esto ajusta el saldo de la cuenta para que la deuda calculada quede en este número — no rompe el
              historial de movimientos.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditandoTarjeta(null)} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editandoManual && (
        <Modal onClose={() => setEditandoManual(null)}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            Corregir monto — {editandoManual.descripcion}
          </h2>
          <form action={handleEditarManual}>
            <div className="field">
              <label htmlFor="monto-manual">Monto adeudado (S/)</label>
              <input
                id="monto-manual"
                name="monto"
                type="number"
                step="0.01"
                min="0"
                defaultValue={editandoManual.montoAdeudado.toFixed(2)}
                required
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditandoManual(null)} disabled={guardando}>
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
