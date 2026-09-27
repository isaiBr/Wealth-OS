"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ICONO_TACHO } from "@/components/icons";
import {
  crearTemaAction,
  editarTemaAction,
  alternarActivoTemaAction,
  eliminarTemaAction,
  actualizarResumenConIaAction,
  generarBriefAhoraAction,
} from "./actions";

interface Tema {
  id: number;
  nombre: string;
  clave: string;
  query: string;
  cantidad: number;
  activo: boolean;
}

export function ConfigBriefView({ temas, resumenConIa }: { temas: Tema[]; resumenConIa: boolean }) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoTema, setEditandoTema] = useState<Tema | null>(null);
  const [eliminandoTema, setEliminandoTema] = useState<Tema | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [actualizandoIa, setActualizandoIa] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [mensajeGenerar, setMensajeGenerar] = useState<string | null>(null);

  async function handleGenerarAhora() {
    setGenerando(true);
    setMensajeGenerar(null);
    try {
      const resultado = await generarBriefAhoraAction();
      setMensajeGenerar(
        resultado.status === "skipped"
          ? `Ya había un brief para hoy (${resultado.date}) — no se generó de nuevo.`
          : `Listo, brief de hoy (${resultado.date}) generado.`
      );
    } catch (e) {
      setMensajeGenerar(e instanceof Error ? e.message : "No se pudo generar el brief");
    } finally {
      setGenerando(false);
    }
  }

  async function handleCrear(formData: FormData) {
    setGuardando(true);
    try {
      await crearTemaAction(formData);
      setModalAbierto(false);
    } finally {
      setGuardando(false);
    }
  }

  async function handleEditar(formData: FormData) {
    setGuardando(true);
    try {
      await editarTemaAction(formData);
      setEditandoTema(null);
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar() {
    if (!eliminandoTema) return;
    setGuardando(true);
    try {
      await eliminarTemaAction(eliminandoTema.id);
      setEliminandoTema(null);
    } finally {
      setGuardando(false);
    }
  }

  async function handleToggleIa() {
    setActualizandoIa(true);
    try {
      await actualizarResumenConIaAction(!resumenConIa);
    } finally {
      setActualizandoIa(false);
    }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="cfg-toggle-row">
          <div className="cfg-info">
            <div className="cfg-nombre">Resumen con IA</div>
            <div className="cfg-meta">
              {resumenConIa
                ? "Top 5 con análisis (Hecho/Interpretación/Predicción) + categorías. Tiene un costo pequeño por día."
                : "Solo fetch + orden de Google, gratis — sin Top 5 ni análisis."}
            </div>
          </div>
          <label className="switch">
            <input type="checkbox" checked={resumenConIa} disabled={actualizandoIa} onChange={handleToggleIa} />
            <span className="track" />
          </label>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="cfg-toggle-row">
          <div className="cfg-info">
            <div className="cfg-nombre">Generar brief de hoy</div>
            <div className="cfg-meta">
              {mensajeGenerar ?? "Corre la generación ahora en vez de esperar al cron de las 6am — no vuelve a gastar si ya existe uno para hoy."}
            </div>
          </div>
          <button className="btn-secondary" type="button" onClick={handleGenerarAhora} disabled={generando}>
            {generando ? "Generando..." : "Generar ahora"}
          </button>
        </div>
      </div>

      <div className="toolbar-row">
        <div>
          <div className="section-title">Temas</div>
          <div className="section-sub">Cada tema se busca por separado, así ninguno se queda sin noticias por competir con los demás</div>
        </div>
        <button className="btn-add" type="button" onClick={() => setModalAbierto(true)}>
          + Nuevo tema
        </button>
      </div>

      {temas.length === 0 ? (
        <p className="empty-note">Todavía no hay temas configurados.</p>
      ) : (
        <div className="card" style={{ padding: "6px 18px" }}>
          {temas.map((tema) => (
            <div className="cfg-row" key={tema.id}>
              <div className="cfg-left">
                <div className="cfg-info">
                  <div className="cfg-nombre">{tema.nombre}</div>
                  <div className="cfg-meta">
                    {tema.query} · {tema.cantidad} noticias/día{!tema.activo && " · inactivo"}
                  </div>
                </div>
              </div>
              <div className="row-right">
                <label className="switch" title={tema.activo ? "Desactivar tema" : "Activar tema"}>
                  <input
                    type="checkbox"
                    checked={tema.activo}
                    onChange={() => alternarActivoTemaAction(tema.id, !tema.activo)}
                  />
                  <span className="track" />
                </label>
                <button
                  type="button"
                  className="edit-btn"
                  aria-label={`Editar tema ${tema.nombre}`}
                  onClick={() => setEditandoTema(tema)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="edit-btn"
                  aria-label={`Eliminar tema ${tema.nombre}`}
                  onClick={() => setEliminandoTema(tema)}
                >
                  {ICONO_TACHO}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="sub" style={{ margin: "10px 2px 0", fontSize: 11.5, color: "var(--ink-faint)" }}>
        Las noticias en inglés se muestran tal cual — no se traducen, para no gastar tokens en eso.
      </p>

      {modalAbierto && (
        <Modal onClose={() => setModalAbierto(false)}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            Nuevo tema
          </h2>
          <form action={handleCrear}>
            <div className="field">
              <label htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" type="text" placeholder="Ej. Ciberseguridad" required />
            </div>
            <div className="field">
              <label htmlFor="query">Términos de búsqueda</label>
              <input id="query" name="query" type="text" placeholder="Ej. ciberseguridad OR ransomware" required />
            </div>
            <div className="field">
              <label htmlFor="cantidad">Noticias garantizadas por día</label>
              <input id="cantidad" name="cantidad" type="number" min={1} max={10} defaultValue={3} required />
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

      {editandoTema && (
        <Modal onClose={() => setEditandoTema(null)}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            Editar tema
          </h2>
          <form action={handleEditar}>
            <input type="hidden" name="id" value={editandoTema.id} />
            <div className="field">
              <label htmlFor="nombre-edit">Nombre</label>
              <input id="nombre-edit" name="nombre" type="text" defaultValue={editandoTema.nombre} required />
            </div>
            <div className="field">
              <label htmlFor="query-edit">Términos de búsqueda</label>
              <input id="query-edit" name="query" type="text" defaultValue={editandoTema.query} required />
            </div>
            <div className="field">
              <label htmlFor="cantidad-edit">Noticias garantizadas por día</label>
              <input id="cantidad-edit" name="cantidad" type="number" min={1} max={10} defaultValue={editandoTema.cantidad} required />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditandoTema(null)} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {eliminandoTema && (
        <ConfirmModal
          titulo={`Eliminar "${eliminandoTema.nombre}"`}
          mensaje="Los briefs ya generados que tenían noticias de este tema no cambian — solo deja de buscarse desde hoy."
          confirmando={guardando}
          onConfirmar={handleEliminar}
          onCancelar={() => setEliminandoTema(null)}
        />
      )}
    </>
  );
}
