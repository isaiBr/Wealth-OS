"use client";

import { usePathname } from "next/navigation";
import { useDomainSwitcher } from "./DomainSwitcherContext";

export function DomainSwitcherButton() {
  const pathname = usePathname();
  const { openSheet } = useDomainSwitcher();
  const nombreDominio = pathname.startsWith("/brief") ? "Brief" : "Finanzas";

  return (
    <button className="domain-switch" type="button" onClick={openSheet} aria-haspopup="dialog">
      <span className="domain-eyebrow">Wealth OS</span>
      <span className="domain-name">
        {nombreDominio}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </span>
    </button>
  );
}
