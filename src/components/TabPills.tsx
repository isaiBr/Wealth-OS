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
}

/**
 * Submenú de pills que agrupa paneles complementarios de una pantalla.
 * En mobile (<900px) solo se ve el panel activo; en desktop las pills se
 * ocultan vía CSS y todos los paneles se muestran a la vez (ver globals.css).
 */
export function TabPillsGroup({ tabs, ariaLabel, children }: TabPillsGroupProps) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");

  return (
    <TabPillsContext.Provider value={{ active, setActive }}>
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
      {children}
    </TabPillsContext.Provider>
  );
}

export function TabPanel({ tabKey, children }: { tabKey: string; children: ReactNode }) {
  const ctx = useContext(TabPillsContext);
  const isActive = ctx?.active === tabKey;
  return <div className={`tab-panel${isActive ? " active-panel" : ""}`}>{children}</div>;
}
