"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  crearMetaCompraAction,
  editarMetaCompraAction,
  actualizarMontoAhorradoAction,
  vincularCompraCuotaAMetaAction,
  cambiarEstadoMetaAction,
  eliminarMetaCompraAction,
} from "./actions";
import type { MetaCompraConProgreso } from "@/db/queries";

const FORMATO = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FORMATO_FECHA = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" });

const METODO_LABEL: Record<string, string> = {
  contado: "Ahorro directo",
  cuotas: "Cuotas de tarjeta",
  cobranzas: "Financiado con cobranzas",
};

interface CompraCuotaOpcion {
  id: number;
  comercio: string;
  montoTotal: number;
}

interface Props {
  metas: MetaCompraConProgreso[];
  comprasCuotas: CompraCuotaOpcion[];
}

function nombreFecha(fechaISO: string): string {
  const [anio, mes] = fechaISO.split("-").map(Number);
  const nombre = FORMATO_FECHA.format(new Date(anio, mes - 1, 1));
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

export function MetasCompraView({ metas, comprasCuotas }: Props) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<MetaCompraConProgreso | undefined>(undefined);
  const [guardando, setGuardando] = useState(false);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);
  const [editandoMonto, setEditandoMonto] = useState<MetaCompraConProgreso | null>(null);
  const [guardandoMonto, setGuardandoMonto] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<MetaCompraConProgreso | null>(null);

  function abrirCreacion() {
    setEditando(undefined);
    setModalAbierto(true);
  }

  function abrirEdicion(m: MetaCompraConProgreso) {
    setEditando(m);
    setModalAbierto(true);
  }

  async function handleSubmit(formData: FormData) {
    setGuardando(true);
    try {
      if (editando) {
        formData.set("id", String(editando.id));
        await editarMetaCompraAction(formData);
      } else {
        await crearMetaCompraAction(formData);
      }
      setModalAbierto(false);
    } finally {
      setGuardando(false);
    }
  }

  async function handleVincular(meta: MetaCompraConProgreso, valor: string) {
    setProcesandoId(meta.id);
    try {
      await vincularCompraCuotaAMetaAction(meta.id, valor === "" ? null : Number(valor));
    } finally {
      setProcesandoId(null);
    }
  }

  async function handleCompletar(meta: MetaCompraConProgreso) {
    setProcesandoId(meta.id);
    try {
      await cambiarEstadoMetaAction(meta.id, "completada");
    } finally {
      setProcesandoId(null);
    }
  }

  async function handleEliminar(meta: MetaCompraConProgreso) {
    setProcesandoId(meta.id);
    try {
      await eliminarMetaCompraAction(meta.id);
      setConfirmandoEliminar(null);
    } finally {
      setProcesandoId(null);
    }
  }

  async function handleActualizarMonto(formData: FormData) {
    if (!editandoMonto) return;
    setGuardandoMonto(true);
    try {
      const monto = parseFloat(String(formData.get("montoAhorrado") ?? ""));
      await actualizarMontoAhorradoAction(editandoMonto.id, monto);
      setEditandoMonto(null);
    } finally {
      setGuardandoMonto(false);
    }
  }

  return (
    <>
      <div className="section-head">
        <div>
          <div className="section-title">Metas de compra</div>
          <div className="section-sub">Cosas que querés comprar — cómo llegar y con qué método de pago</div>
        </div>
        <button className="text-link" type="button" onClick={abrirCreacion}>
          + Nueva meta
        </button>
      </div>
      <div className="card">
        {metas.length === 0 && (
          <p className="empty-note">Sin metas activas — creá una para empezar a apartar plata con un objetivo.</p>
        )}
        {metas.map((m) => {
          const pct = m.precioObjetivo > 0 ? (m.progreso / m.precioObjetivo) * 100 : 0;
          return (
            <div className="cat-row" key={m.id}>
              <div className="cat-top">
                <span>{m.nombre}</span>
                <span className="row-right">
                  <span className="cifras">
                    <strong className="tabular">S/ {FORMATO.format(m.progreso)}</strong> / S/ {FORMATO.format(m.precioObjetivo)}
                  </span>
                  {m.categoriaId === null && m.metodoPago !== "cuotas" && (
                    <button
                      className="edit-btn"
                      type="button"
                      aria-label={`Actualizar monto ahorrado de ${m.nombre}`}
                      title="Actualizar monto ahorrado"
                      onClick={() => setEditandoMonto(m)}
                    >
                      ✎
                    </button>
                  )}
                  <button className="edit-btn" type="button" onClick={() => abrirEdicion(m)} aria-label={`Editar meta ${m.nombre}`} title="Editar nombre, precio, fecha y método">
                    ⚙
                  </button>
                  <button
                    className="edit-btn"
                    type="button"
                    aria-label={`Marcar ${m.nombre} como completada`}
                    title="Marcar como completada"
                    disabled={procesandoId === m.id}
                    onClick={() => handleCompletar(m)}
                  >
                    ✓
                  </button>
                  <button
                    className="edit-btn"
                    type="button"
                    aria-label={`Eliminar meta ${m.nombre}`}
                    title="Eliminar"
                    disabled={procesandoId === m.id}
                    onClick={() => setConfirmandoEliminar(m)}
                  >
                    ✕
                  </button>
                </span>
              </div>
              <div className="cat-bar-track">
                <div className="cat-bar-fill" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              <div className="cat-zero-note">
                {METODO_LABEL[m.metodoPago] ?? m.metodoPago}
                {m.fechaDeseada && ` · meta: ${nombreFecha(m.fechaDeseada)}`}
              </div>
              {m.metodoPago === "cuotas" && (
                <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
                  <select
                    value={m.compraCuotaId ?? ""}
                    onChange={(e) => handleVincular(m, e.target.value)}
                    disabled={procesandoId === m.id}
                    style={{ fontSize: 12 }}
                  >
                    <option value="">Sin vincular a ninguna compra todavía</option>
                    {comprasCuotas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.comercio} (S/ {FORMATO.format(c.montoTotal)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {m.sugerenciaMensual !== null && m.sugerenciaMensual > 0 && (
                <div className="cat-flag" style={{ color: "var(--ink-muted)", marginTop: 8 }}>
                  Apartando S/ {FORMATO.format(m.sugerenciaMensual)}/mes la juntás a tiempo para tu fecha objetivo.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modalAbierto && (
        <Modal onClose={() => setModalAbierto(false)}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            {editando ? `Editar meta — ${editando.nombre}` : "Nueva meta de compra"}
          </h2>
          <form action={handleSubmit}>
            <div className="field">
              <label htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" type="text" defaultValue={editando?.nombre ?? ""} required />
            </div>
            <div className="field">
              <label htmlFor="precioObjetivo">Precio objetivo (S/)</label>
              <input
                id="precioObjetivo"
                name="precioObjetivo"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={editando?.precioObjetivo ?? ""}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="fechaDeseada">Fecha deseada (opcional)</label>
              <input id="fechaDeseada" name="fechaDeseada" type="month" defaultValue={editando?.fechaDeseada?.slice(0, 7) ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="metodoPago">Método de pago</label>
              <select id="metodoPago" name="metodoPago" defaultValue={editando?.metodoPago ?? "contado"} required>
                <option value="contado">Ahorro directo</option>
                <option value="cuotas">Cuotas de tarjeta</option>
                <option value="cobranzas">Financiado con cobranzas pendientes</option>
              </select>
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

      {editandoMonto && (
        <Modal onClose={() => setEditandoMonto(null)}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            Actualizar monto ahorrado — {editandoMonto.nombre}
          </h2>
          <form action={handleActualizarMonto}>
            <div className="field">
              <label htmlFor="montoAhorrado">Monto ahorrado (S/)</label>
              <input
                id="montoAhorrado"
                name="montoAhorrado"
                type="number"
                step="0.01"
                min="0"
                defaultValue={editandoMonto.montoAhorrado.toFixed(2)}
                required
              />
            </div>
            <p className="section-sub" style={{ marginTop: 0 }}>
              Es el monto total que ya tienes apartado para esta meta, no un aporte — lo actualizas a mano, no hace
              falta registrar un movimiento.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditandoMonto(null)} disabled={guardandoMonto}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={guardandoMonto}>
                {guardandoMonto ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirmandoEliminar && (
        <ConfirmModal
          titulo={`¿Eliminar meta "${confirmandoEliminar.nombre}"?`}
          mensaje="No se puede deshacer."
          confirmando={procesandoId === confirmandoEliminar.id}
          onConfirmar={() => handleEliminar(confirmandoEliminar)}
          onCancelar={() => setConfirmandoEliminar(null)}
        />
      )}
    </>
  );
}
