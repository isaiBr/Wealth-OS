"use client";

import { useEffect, useRef, useState } from "react";

export interface RowMenuAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

// Agrupa las acciones de una fila (editar, marcar pagado, eliminar...) detrás
// de un botón "⋯" — en vez de saturar la fila con 3+ íconos sueltos.
export function RowMenu({ actions, ariaLabel }: { actions: RowMenuAction[]; ariaLabel: string }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, [abierto]);

  return (
    <div className={`row-menu${abierto ? " open" : ""}`} ref={ref}>
      <button
        type="button"
        className="row-menu-btn"
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        ⋯
      </button>
      {abierto && (
        <div className="row-menu-list">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className={a.danger ? "danger" : undefined}
              disabled={a.disabled}
              onClick={() => {
                setAbierto(false);
                a.onClick();
              }}
            >
              <span className="row-menu-icon">{a.icon}</span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
