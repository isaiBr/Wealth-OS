"use client";

import { useState } from "react";
import { eliminarReglaAction, actualizarConfiguracionIAAction } from "./actions";
import type { Categoria, ReglaCategorizacion, ConfiguracionIa } from "@/db/queries";

interface Props {
  categorias: Categoria[];
  reglas: ReglaCategorizacion[];
  configuracion: ConfiguracionIa;
}

export function ReglasCategorizacionView({ categorias, reglas, configuracion }: Props) {
  const [procesandoId, setProcesandoId] = useState<number | null>(null);
  const [config, setConfig] = useState(configuracion);
  const [guardandoConfig, setGuardandoConfig] = useState<keyof ConfiguracionIa | null>(null);

  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));

  async function handleEliminarRegla(regla: ReglaCategorizacion) {
    setProcesandoId(regla.id);
    try {
      await eliminarReglaAction(regla.id);
    } finally {
      setProcesandoId(null);
    }
  }

  async function handleToggleConfig(campo: keyof ConfiguracionIa) {
    const nuevoValor = !config[campo];
    setConfig({ ...config, [campo]: nuevoValor });
    setGuardandoConfig(campo);
    try {
      await actualizarConfiguracionIAAction({ [campo]: nuevoValor });
    } finally {
      setGuardandoConfig(null);
    }
  }

  return (
    <>
      <div className="section-head">
        <div>
          <div className="section-title">Categorización automática</div>
          <div className="section-sub">Capa 1: reglas por comercio · Capa 2: IA (Claude Haiku) cuando ninguna regla coincide</div>
        </div>
      </div>
      <div className="card" style={{ padding: "4px 18px" }}>
        <div className="cfg-toggle-row">
          <div className="cfg-info">
            <div className="cfg-nombre" style={{ marginBottom: 1 }}>Sugerir con IA</div>
            <div className="cfg-meta">Si ninguna regla coincide, deja que la IA proponga una categoría</div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={config.sugerirConIa}
              disabled={guardandoConfig === "sugerirConIa"}
              onChange={() => handleToggleConfig("sugerirConIa")}
            />
            <span className="track" />
          </label>
        </div>
        <div className="cfg-toggle-row" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="cfg-info">
            <div className="cfg-nombre" style={{ marginBottom: 1 }}>Aprender reglas nuevas</div>
            <div className="cfg-meta">Al confirmar o corregir una categoría, guarda la regla para la próxima vez</div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={config.aprenderReglasNuevas}
              disabled={guardandoConfig === "aprenderReglasNuevas"}
              onChange={() => handleToggleConfig("aprenderReglasNuevas")}
            />
            <span className="track" />
          </label>
        </div>
      </div>

      <div className="section-head">
        <div>
          <div className="section-title">Reglas de categorización</div>
          <div className="section-sub">
            {reglas.length} regla{reglas.length === 1 ? "" : "s"} activa{reglas.length === 1 ? "" : "s"} · así decide
            Wealth OS la categoría de cada movimiento
          </div>
        </div>
      </div>
      <div className="card" style={{ padding: "6px 18px" }}>
        {reglas.length === 0 && (
          <p className="empty-note">
            Todavía no se aprendió ninguna regla — se van a ir guardando solas a medida que confirmes categorías en
            Movimientos.
          </p>
        )}
        {reglas.map((r) => {
          const categoria = categoriaPorId.get(r.categoriaId);
          return (
            <div className="rule-row" key={r.id}>
              <div className="rule-info">
                <div className="rule-top">
                  <span className="rule-patron" title={r.patron}>
                    {r.patron}
                  </span>
                  <span className="rule-arrow">→</span>
                  <span className="rule-cat">{categoria?.nombre ?? "(categoría eliminada)"}</span>
                </div>
                <div className="rule-meta">
                  {r.origen === "ia" ? <span className="ai-badge">IA</span> : "Manual"} · usada {r.vecesUsada}{" "}
                  {r.vecesUsada === 1 ? "vez" : "veces"}
                </div>
              </div>
              <button
                type="button"
                className="edit-btn"
                aria-label={`Eliminar regla ${r.patron}`}
                title="Eliminar regla"
                disabled={procesandoId === r.id}
                onClick={() => handleEliminarRegla(r)}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <p className="section-sub" style={{ marginTop: 8 }}>
        Cada vez que confirmas o corriges una categoría sugerida en Movimientos, esta lista se actualiza sola.
      </p>
    </>
  );
}
