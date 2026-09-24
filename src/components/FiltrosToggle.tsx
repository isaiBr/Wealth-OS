"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const FiltrosVisiblesContext = createContext<{ visibles: boolean; alternar: () => void } | null>(null);

/** Guarda si el panel de filtros está abierto — el botón y el panel viven en
 * lugares distintos del árbol (uno junto a las pills, otro dentro del tab),
 * así que comparten este estado por contexto en vez de por props. */
export function FiltrosToggleProvider({
  children,
  abiertoInicial = false,
}: {
  children: ReactNode;
  abiertoInicial?: boolean;
}) {
  const [visibles, setVisibles] = useState(abiertoInicial);
  return (
    <FiltrosVisiblesContext.Provider value={{ visibles, alternar: () => setVisibles((v) => !v) }}>
      {children}
    </FiltrosVisiblesContext.Provider>
  );
}

export function FiltrosToggleBoton() {
  const ctx = useContext(FiltrosVisiblesContext);
  if (!ctx) return null;
  return (
    <button type="button" className="text-link" onClick={ctx.alternar}>
      {ctx.visibles ? "Ocultar filtros" : "Mostrar filtros"}
    </button>
  );
}

export function FiltrosToggleContenido({ children }: { children: ReactNode }) {
  const ctx = useContext(FiltrosVisiblesContext);
  if (!ctx?.visibles) return null;
  return <>{children}</>;
}
