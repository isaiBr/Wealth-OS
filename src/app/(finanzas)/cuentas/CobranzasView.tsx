"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { RowMenu } from "@/components/RowMenu";
import { ICONO_TACHO } from "@/components/icons";
import { crearCobranzaAction, editarCobranzaAction, marcarCobranzaCobradaAction, eliminarCobranzaAction } from "./actions";
import type { Cobranza } from "@/db/queries";

const FORMATO = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const POR_PAGINA = 10;

export function CobranzasView({ cobranzas }: { cobranzas: Cobranza[] }) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Cobranza | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<Cobranza | null>(null);
  const [vista, setVista] = useState<"pendientes" | "historial">("pendientes");
  const [pagina, setPagina] = useState(1);

  const pendientes = cobranzas.filter((c) => c.estado === "pendiente");
  const cobradas = cobranzas.filter((c) => c.estado === "cobrado");
  const totalPendiente = pendientes.reduce((acc, c) => acc + c.montoEsperado, 0);
  const totalPaginas = Math.max(1, Math.ceil(cobradas.length / POR_PAGINA));
  const cobradasPagina = cobradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  function cambiarVista(v: "pendientes" | "historial") {
    setVista(v);
    setPagina(1);
  }

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

      <nav className="subpills" aria-label="Cobranzas">
        <button type="button" className={vista === "pendientes" ? "active" : undefined} onClick={() => cambiarVista("pendientes")}>
          Pendientes
        </button>
        <button type="button" className={vista === "historial" ? "active" : undefined} onClick={() => cambiarVista("historial")}>
          Historial{cobradas.length > 0 && ` (${cobradas.length})`}
        </button>
      </nav>

      {vista === "pendientes" && (
        <div className="card debt-card">
          {pendientes.length === 0 ? (
            <p className="empty-note">Sin cobranzas pendientes.</p>
          ) : (
            <>
              {pendientes.map((c, i) => (
                <div key={c.id} className="cuenta" style={i > 0 ? { marginTop: 8 } : undefined}>
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
                    <RowMenu
                      ariaLabel={`Más acciones para ${c.descripcion}`}
                      actions={[
                        {
                          label: "Marcar cobrada",
                          icon: "✓",
                          disabled: procesandoId === c.id,
                          onClick: () => handleToggle(c),
                        },
                        {
                          label: "Eliminar",
                          icon: ICONO_TACHO,
                          danger: true,
                          disabled: procesandoId === c.id,
                          onClick: () => setConfirmandoEliminar(c),
                        },
                      ]}
                    />
                  </div>
                </div>
              ))}
              <div className="debt-meta" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--border)" }}>
                <span>Total pendiente</span>
                <span className="tabular">S/ {FORMATO.format(totalPendiente)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {vista === "historial" && (
        <div className="card debt-card">
          {cobradas.length === 0 ? (
            <p className="empty-note">Todavía no cobraste ninguna.</p>
          ) : (
            <>
              {cobradasPagina.map((c, i) => (
                <div key={c.id} className="cuenta" style={{ opacity: 0.65, ...(i > 0 ? { marginTop: 8 } : {}) }}>
                  <div className="cuenta-info" style={{ minWidth: 0 }}>
                    <button
                      type="button"
                      className="tx-merchant"
                      style={{ color: "var(--ink)", textDecoration: "line-through", textAlign: "left" }}
                      onClick={() => setEditando(c)}
                    >
                      {c.descripcion}
                    </button>
                  </div>
                  <div className="row-right">
                    <div className="saldo tabular">S/ {FORMATO.format(c.montoEsperado)}</div>
                    <RowMenu
                      ariaLabel={`Más acciones para ${c.descripcion}`}
                      actions={[
                        {
                          label: "Marcar pendiente",
                          icon: "↺",
                          disabled: procesandoId === c.id,
                          onClick: () => handleToggle(c),
                        },
                        {
                          label: "Eliminar",
                          icon: ICONO_TACHO,
                          danger: true,
                          disabled: procesandoId === c.id,
                          onClick: () => setConfirmandoEliminar(c),
                        },
                      ]}
                    />
                  </div>
                </div>
              ))}
              {totalPaginas > 1 && (
                <div className="pagination">
                  <button
                    type="button"
                    disabled={pagina === 1}
                    aria-label="Página anterior"
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  >
                    ‹
                  </button>
                  Página {pagina} de {totalPaginas}
                  <button
                    type="button"
                    disabled={pagina === totalPaginas}
                    aria-label="Página siguiente"
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  >
                    ›
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

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
