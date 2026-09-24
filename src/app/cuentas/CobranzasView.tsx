"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { crearCobranzaAction, editarCobranzaAction, marcarCobranzaCobradaAction, eliminarCobranzaAction } from "./actions";
import type { Cobranza } from "@/db/queries";

const FORMATO = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CobranzasView({ cobranzas }: { cobranzas: Cobranza[] }) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Cobranza | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<Cobranza | null>(null);

  const pendientes = cobranzas.filter((c) => c.estado === "pendiente");
  const cobradas = cobranzas.filter((c) => c.estado === "cobrado");
  const totalPendiente = pendientes.reduce((acc, c) => acc + c.montoEsperado, 0);

  async function handleSubmit(formData: FormData) {
    setGuardando(true);
    try {
      await crearCobranzaAction(formData);
      setModalAbierto(false);
    } finally {
      setGuardando(false);
    }
  }

  async function handleEditar(formData: FormData) {
    setGuardando(true);
    try {
      await editarCobranzaAction(formData);
      setEditando(null);
    } finally {
      setGuardando(false);
    }
  }

  async function handleToggle(c: Cobranza) {
    setProcesandoId(c.id);
    try {
      await marcarCobranzaCobradaAction(c.id, c.estado !== "cobrado");
    } finally {
      setProcesandoId(null);
    }
  }

  async function handleEliminar(c: Cobranza) {
    setProcesandoId(c.id);
    try {
      await eliminarCobranzaAction(c.id);
      setConfirmandoEliminar(null);
    } finally {
      setProcesandoId(null);
    }
  }

  return (
    <>
      <div className="toolbar-row" style={{ marginTop: 28 }}>
        <span className="section-title">Por cobrar</span>
        <button className="btn-add" type="button" onClick={() => setModalAbierto(true)}>
          + Agregar cobranza
        </button>
      </div>

      <div className="card debt-card">
        {pendientes.length === 0 ? (
          <p className="empty-note">Sin cobranzas pendientes.</p>
        ) : (
          <>
            {pendientes.map((c, i) => (
              <div
                key={c.id}
                className="cuenta"
                style={i > 0 ? { marginTop: 8 } : undefined}
              >
                <div className="cuenta-info" style={{ minWidth: 0 }}>
                  <button
                    type="button"
                    className="tx-merchant"
                    style={{ color: "var(--ink)", textAlign: "left" }}
                    onClick={() => setEditando(c)}
                  >
                    {c.descripcion}
                  </button>
                </div>
                <div className="row-right">
                  <div className="saldo tabular" style={{ color: "var(--accent-strong)" }}>
                    S/ {FORMATO.format(c.montoEsperado)}
                  </div>
                  <button
                    type="button"
                    className="edit-btn"
                    aria-label={`Marcar "${c.descripcion}" como cobrada`}
                    title="Marcar como cobrada"
                    disabled={procesandoId === c.id}
                    onClick={() => handleToggle(c)}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    className="edit-btn"
                    aria-label={`Eliminar cobranza "${c.descripcion}"`}
                    title="Eliminar"
                    disabled={procesandoId === c.id}
                    onClick={() => setConfirmandoEliminar(c)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <div className="debt-meta" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--border)" }}>
              <span>Total pendiente</span>
              <span className="tabular">S/ {FORMATO.format(totalPendiente)}</span>
            </div>
          </>
        )}

        {cobradas.length > 0 && (
          <details style={{ marginTop: 14 }}>
            <summary style={{ fontSize: 11.5, color: "var(--ink-faint)", cursor: "pointer" }}>
              Ya cobradas ({cobradas.length})
            </summary>
            <div style={{ marginTop: 8 }}>
              {cobradas.map((c) => (
                <div className="cuenta" key={c.id} style={{ marginTop: 8, opacity: 0.6 }}>
                  <div className="cuenta-info" style={{ minWidth: 0 }}>
                    <div className="nombre-cuenta" style={{ color: "var(--ink)", textDecoration: "line-through" }}>
                      {c.descripcion}
                    </div>
                  </div>
                  <div className="row-right">
                    <div className="saldo tabular">S/ {FORMATO.format(c.montoEsperado)}</div>
                    <button
                      type="button"
                      className="edit-btn"
                      aria-label={`Revertir cobranza "${c.descripcion}"`}
                      title="Marcar como pendiente de nuevo"
                      disabled={procesandoId === c.id}
                      onClick={() => handleToggle(c)}
                    >
                      ↺
                    </button>
                    <button
                      type="button"
                      className="edit-btn"
                      aria-label={`Eliminar cobranza "${c.descripcion}"`}
                      title="Eliminar"
                      disabled={procesandoId === c.id}
                      onClick={() => setConfirmandoEliminar(c)}
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
            Agregar cobranza
          </h2>
          <form action={handleSubmit}>
            <div className="field">
              <label htmlFor="descripcion">Descripción</label>
              <input id="descripcion" name="descripcion" type="text" placeholder="Préstamo a Fulano" required />
            </div>
            <div className="field">
              <label htmlFor="montoEsperado">Monto esperado (S/)</label>
              <input id="montoEsperado" name="montoEsperado" type="number" step="0.01" min="0.01" required />
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

      {editando && (
        <Modal onClose={() => setEditando(null)}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            Editar cobranza
          </h2>
          <form action={handleEditar}>
            <input type="hidden" name="id" value={editando.id} />
            <div className="field">
              <label htmlFor="descripcion-editar">Descripción</label>
              <input id="descripcion-editar" name="descripcion" type="text" defaultValue={editando.descripcion} required />
            </div>
            <div className="field">
              <label htmlFor="montoEsperado-editar">Monto esperado (S/)</label>
              <input
                id="montoEsperado-editar"
                name="montoEsperado"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={editando.montoEsperado.toFixed(2)}
                required
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

      {confirmandoEliminar && (
        <ConfirmModal
          titulo={`¿Eliminar cobranza "${confirmandoEliminar.descripcion}"?`}
          mensaje="No se puede deshacer."
          confirmando={procesandoId === confirmandoEliminar.id}
          onConfirmar={() => handleEliminar(confirmandoEliminar)}
          onCancelar={() => setConfirmandoEliminar(null)}
        />
      )}
    </>
  );
}
