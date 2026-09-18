"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import {
  crearCategoriaAction,
  editarCategoriaAction,
  archivarCategoriaAction,
  crearTagAction,
  eliminarTagAction,
} from "./actions";
import type { Categoria, Tag } from "@/db/queries";

const BUCKET_LABEL: Record<string, string> = {
  fijos: "Costos fijos",
  inversion: "Inversiones",
  ahorro: "Ahorro",
  libre: "Gasto libre",
};

interface Props {
  categorias: Categoria[];
  tags: Tag[];
}

export function ConfiguracionView({ categorias, tags }: Props) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Categoria | undefined>(undefined);
  const [guardando, setGuardando] = useState(false);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState("");
  const [guardandoTag, setGuardandoTag] = useState(false);
  const [procesandoTagId, setProcesandoTagId] = useState<number | null>(null);

  function abrirCreacion() {
    setEditando(undefined);
    setModalAbierto(true);
  }

  function abrirEdicion(c: Categoria) {
    setEditando(c);
    setModalAbierto(true);
  }

  async function handleSubmit(formData: FormData) {
    setGuardando(true);
    try {
      if (editando) {
        formData.set("id", String(editando.id));
        await editarCategoriaAction(formData);
      } else {
        await crearCategoriaAction(formData);
      }
      setModalAbierto(false);
    } finally {
      setGuardando(false);
    }
  }

  async function handleArchivar(c: Categoria) {
    setProcesandoId(c.id);
    try {
      await archivarCategoriaAction(c.id, !c.archivada);
    } finally {
      setProcesandoId(null);
    }
  }

  async function handleCrearTag() {
    const nombre = nuevaEtiqueta.trim();
    if (!nombre) return;
    setGuardandoTag(true);
    try {
      const formData = new FormData();
      formData.set("nombre", nombre);
      await crearTagAction(formData);
      setNuevaEtiqueta("");
    } finally {
      setGuardandoTag(false);
    }
  }

  async function handleEliminarTag(tag: Tag) {
    setProcesandoTagId(tag.id);
    try {
      await eliminarTagAction(tag.id);
    } finally {
      setProcesandoTagId(null);
    }
  }

  return (
    <>
      <div className="section-head">
        <div>
          <div className="section-title">Categorías</div>
          <div className="section-sub">Se usan en Movimientos y Presupuesto — archivar no borra movimientos pasados.</div>
        </div>
        <button className="text-link" type="button" onClick={abrirCreacion}>
          + Nueva categoría
        </button>
      </div>
      <div className="card" style={{ padding: "6px 18px" }}>
        {categorias.length === 0 && <p className="empty-note">Todavía no hay categorías.</p>}
        {categorias.map((c) => (
          <div className="cfg-row" key={c.id}>
            <div className="cfg-left">
              <span
                className="legend-dot"
                style={{ background: c.archivada ? "var(--ink-faint)" : "var(--accent)", opacity: c.archivada ? 0.5 : 1 }}
              />
              <div className="cfg-info">
                <div className="cfg-nombre">
                  {c.nombre}
                  {c.archivada && <span className="ai-badge">Archivada</span>}
                </div>
                <div className="cfg-meta">Bucket: {BUCKET_LABEL[c.bucket] ?? c.bucket}</div>
              </div>
            </div>
            <div className="row-right">
              <button
                type="button"
                className="edit-btn"
                aria-label={`Editar categoría ${c.nombre}`}
                title="Editar"
                onClick={() => abrirEdicion(c)}
              >
                ✎
              </button>
              <button
                type="button"
                className="edit-btn"
                aria-label={c.archivada ? `Desarchivar categoría ${c.nombre}` : `Archivar categoría ${c.nombre}`}
                title={c.archivada ? "Desarchivar" : "Archivar"}
                disabled={procesandoId === c.id}
                onClick={() => handleArchivar(c)}
              >
                {c.archivada ? "↺" : "⊘"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="section-head">
        <div>
          <div className="section-title">Etiquetas</div>
          <div className="section-sub">Detalle extra dentro de una categoría — un movimiento puede tener varias a la vez.</div>
        </div>
      </div>
      <div className="card" style={{ padding: "16px 18px" }}>
        <div className="tag-cloud">
          {tags.map((t) => (
            <span className="tx-tag-pill" key={t.id}>
              {t.nombre}
              <button
                type="button"
                aria-label={`Eliminar etiqueta ${t.nombre}`}
                disabled={procesandoTagId === t.id}
                onClick={() => handleEliminarTag(t)}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={nuevaEtiqueta}
            onChange={(e) => setNuevaEtiqueta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCrearTag();
              }
            }}
            placeholder="Nueva etiqueta..."
            disabled={guardandoTag}
            style={{
              border: "1px dashed var(--ink-faint)",
              background: "none",
              borderRadius: 5,
              padding: "5px 10px",
              fontSize: 12,
              color: "var(--ink)",
              minWidth: 120,
            }}
          />
        </div>
      </div>

      {modalAbierto && (
        <Modal onClose={() => setModalAbierto(false)}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            {editando ? `Editar categoría — ${editando.nombre}` : "Nueva categoría"}
          </h2>
          <form action={handleSubmit}>
            <div className="field">
              <label htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" type="text" defaultValue={editando?.nombre ?? ""} required />
            </div>
            <div className="field">
              <label htmlFor="bucket">Bucket</label>
              <select id="bucket" name="bucket" defaultValue={editando?.bucket ?? "libre"} required>
                <option value="fijos">Costos fijos</option>
                <option value="inversion">Inversiones</option>
                <option value="ahorro">Ahorro</option>
                <option value="libre">Gasto libre</option>
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
    </>
  );
}
