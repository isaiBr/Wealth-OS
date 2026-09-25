"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface Tab {
  key: string;
  label: string;
}

const TabPillsContext = createContext<{ active: string; setActive: (key: string) => void } | null>(null);

interface TabPillsGroupProps {
  tabs: Tab[];
  ariaLabel: string;
  children: ReactNode;
  // Contenido opcional pegado al borde derecho de la fila de pills.
  extra?: ReactNode;
  // Tab con la que arrancar (ej. desde un link de Inicio con ?tab=extras) —
  // si no es una key válida de `tabs`, se ignora y arranca en la primera.
  initialTab?: string;
}

/**
 * Primer nivel de navegación de una pantalla — TODAS las secciones de esa
 * pantalla son tabs acá (no se reparten entre col-main/col-side: eso llevaba
 * a una columna vacía cuando la otra tenía el tab activo). Real en todos los
 * tamaños: solo se ve el panel activo, mobile y desktop por igual. Ancho
 * limitado en desktop (ver .tab-pills-group en globals.css) para que un
 * panel angosto (ej. una lista de cuentas) no quede estirado a todo el ancho.
 */
export function TabPillsGroup({ tabs, ariaLabel, children, extra, initialTab }: TabPillsGroupProps) {
  const inicial = initialTab && tabs.some((t) => t.key === initialTab) ? initialTab : (tabs[0]?.key ?? "");
  const [active, setActive] = useState(inicial);

  const nav = (
    <nav className="tab-pills" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={tab.key === active ? "active" : undefined}
          onClick={() => setActive(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );

  return (
    <TabPillsContext.Provider value={{ active, setActive }}>
      <div className="tab-pills-group">
        {extra ? (
          <div className="tab-pills-row">
            {nav}
            {extra}
          </div>
        ) : (
          nav
        )}
        {children}
      </div>
    </TabPillsContext.Provider>
  );
}

export function TabPanel({ tabKey, children }: { tabKey: string; children: ReactNode }) {
  const ctx = useContext(TabPillsContext);
  const isActive = ctx?.active === tabKey;
  return <div className={`tab-panel${isActive ? " active-panel" : ""}`}>{children}</div>;
}
