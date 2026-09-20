"use client";

import { createContext, useContext, useState } from "react";

interface DomainSwitcherContextValue {
  open: boolean;
  openSheet: () => void;
  closeSheet: () => void;
}

const DomainSwitcherContext = createContext<DomainSwitcherContextValue | null>(null);

export function DomainSwitcherProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <DomainSwitcherContext.Provider
      value={{ open, openSheet: () => setOpen(true), closeSheet: () => setOpen(false) }}
    >
      {children}
    </DomainSwitcherContext.Provider>
  );
}

export function useDomainSwitcher() {
  const ctx = useContext(DomainSwitcherContext);
  if (!ctx) throw new Error("useDomainSwitcher debe usarse dentro de DomainSwitcherProvider");
  return ctx;
}
