"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDomainSwitcher } from "./DomainSwitcherContext";

const DOMINIOS = [
  {
    key: "finanzas",
    href: "/",
    nombre: "Finanzas",
    descripcion: "Movimientos, presupuesto, cuentas",
    icon: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),
  },
  {
    key: "brief",
    href: "/brief",
    nombre: "Brief",
    descripcion: "Inteligencia diaria curada",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4l3 2" />
      </>
    ),
  },
];

function SwitcherIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export function DomainSwitcherSheet() {
  const pathname = usePathname();
  const { open, closeSheet } = useDomainSwitcher();
  const dominioActivo = pathname.startsWith("/brief") ? "brief" : "finanzas";

  return (
    <>
      <div
        className={`switcher-overlay${open ? " show" : ""}`}
        onClick={closeSheet}
        aria-hidden="true"
      />
      <div
        className={`switcher-sheet${open ? " show" : ""}`}
        role="dialog"
        aria-label="Cambiar de espacio"
        aria-hidden={!open}
      >
        <div className="switcher-handle" />
        <div className="switcher-label">Cambiar de espacio</div>

        {DOMINIOS.map((dominio) => (
          <Link
            key={dominio.key}
            href={dominio.href}
            className={`switcher-option${dominioActivo === dominio.key ? " active" : ""}`}
            onClick={closeSheet}
          >
            <span className="switcher-icon">
              <SwitcherIcon>{dominio.icon}</SwitcherIcon>
            </span>
            <span className="switcher-body">
              <span className="switcher-name">{dominio.nombre}</span>
              <span className="switcher-desc">{dominio.descripcion}</span>
            </span>
            <svg
              className="switcher-check"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12l5 5 9-9" />
            </svg>
          </Link>
        ))}

        <div className="switcher-option soon">
          <span className="switcher-icon">
            <SwitcherIcon>
              <path d="M12 5v14M5 12h14" />
            </SwitcherIcon>
          </span>
          <span className="switcher-desc">Próximo módulo del segundo cerebro</span>
        </div>
      </div>
    </>
  );
}
