"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mesActual, nombreMes } from "@/logic/mes";

function IconoCalendario() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  );
}

interface Props {
  mes: string;
  basePath: string;
  // Otros filtros de la página (categoriaId, tagId, q, etc.) que deben
  // conservarse al cambiar de mes — se pasan tal cual vinieron de searchParams.
  paramsActuales?: Record<string, string | undefined>;
}

const MESES_CORTOS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

function construirHref(basePath: string, paramsActuales: Props["paramsActuales"], mes: string): string {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(paramsActuales ?? {})) {
    if (valor && clave !== "mes") params.set(clave, valor);
  }
  params.set("mes", mes);
  return `${basePath}?${params.toString()}`;
}

/** Botón que abre un desplegable con año + grilla de meses, para saltar directo sin ir mes a mes. */
export function MesSelector({ mes, basePath, paramsActuales }: Props) {
  const router = useRouter();
  const [anioSel, mesSel] = mes.split("-").map(Number);
  const [anioActual, mesActualNum] = mesActual().split("-").map(Number);

  const [abierto, setAbierto] = useState(false);
  const [anioPanel, setAnioPanel] = useState(anioSel);

  function esFuturo(anio: number, m: number): boolean {
    return anio > anioActual || (anio === anioActual && m > mesActualNum);
  }

  function abrir() {
    setAnioPanel(anioSel);
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
  }

  function cambiarAnioPanel(delta: number) {
    const nuevo = anioPanel + delta;
    if (nuevo > anioActual) return;
    setAnioPanel(nuevo);
  }

  function elegirMes(m: number) {
    if (esFuturo(anioPanel, m)) return;
    setAbierto(false);
    router.push(construirHref(basePath, paramsActuales, `${anioPanel}-${String(m).padStart(2, "0")}`));
  }

  return (
    <div className="mes-selector-wrap">
      <button
        type="button"
        className="mes-trigger"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label={`Elegir mes — actual: ${nombreMes(mes)} ${anioSel}`}
        onClick={() => (abierto ? cerrar() : abrir())}
      >
        <IconoCalendario />
        <span className="mes-trigger-label">
          {String(mesSel).padStart(2, "0")}/{String(anioSel).slice(2)}
        </span>
      </button>

      {abierto && (
        <div className="mes-panel" role="dialog" aria-label="Elegir mes" onKeyDown={(e) => e.key === "Escape" && cerrar()}>
          <div className="mes-panel-anio">
            <button type="button" className="mes-nav-btn small" aria-label="Año anterior" onClick={() => cambiarAnioPanel(-1)}>
              ‹
            </button>
            <span className="mes-panel-anio-label">{anioPanel}</span>
            <button
              type="button"
              className="mes-nav-btn small"
              aria-label="Año siguiente"
              disabled={anioPanel >= anioActual}
              onClick={() => cambiarAnioPanel(1)}
            >
              ›
            </button>
          </div>
          <div className="mes-panel-grid">
            {MESES_CORTOS.map((abrev, i) => {
              const m = i + 1;
              const futuro = esFuturo(anioPanel, m);
              const activo = anioPanel === anioSel && m === mesSel;
              return (
                <button
                  key={abrev}
                  type="button"
                  className={`mes-mes-btn${activo ? " active" : ""}`}
                  disabled={futuro}
                  onClick={() => elegirMes(m)}
                >
                  {abrev}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {abierto && <div className="mes-panel-backdrop" onClick={cerrar} />}
    </div>
  );
}
