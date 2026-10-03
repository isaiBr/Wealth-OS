"use client";

import { useTransition } from "react";
import { alternarOcultarSaldosAction } from "@/app/(finanzas)/cuentas/actions";

const ICONO_OJO = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const ICONO_OJO_TACHADO = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <path d="M9.9 5.2A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.1 6.1A17 17 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 4-.8" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
  </svg>
);

export function OcultarSaldosToggle({ ocultos }: { ocultos: boolean }) {
  const [pendiente, startTransition] = useTransition();
  const etiqueta = ocultos ? "Mostrar saldos" : "Ocultar saldos";
  return (
    <button
      type="button"
      className="text-link"
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      aria-pressed={ocultos}
      aria-label={etiqueta}
      title={etiqueta}
      disabled={pendiente}
      onClick={() => startTransition(() => alternarOcultarSaldosAction(!ocultos))}
    >
      {ocultos ? ICONO_OJO_TACHADO : ICONO_OJO}
      {etiqueta}
    </button>
  );
}
