"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { configurarFondoEmergenciaAction } from "./actions";
import type { FondoEmergenciaInfo } from "@/db/queries";

const FORMATO = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function FondoEmergenciaView({
  fondo,
  cuentas,
}: {
  fondo: FondoEmergenciaInfo | null;
  cuentas: { id: number; nombre: string }[];
}) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(formData: FormData) {
    setGuardando(true);
    try {
      await configurarFondoEmergenciaAction(formData);
      setModalAbierto(false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="section-head with-action">
        <div className="section-title">Fondo de emergencia</div>
        <button className="text-link" type="button" onClick={() => setModalAbierto(true)}>
          {fondo ? "Editar meta" : "Configurar"}
        </button>
      </div>
      <div className="card">
        {!fondo ? (
          <p className="empty-note">Todavía no configuras un fondo de emergencia — dale a "Configurar" para elegir la cuenta y la meta.</p>
        ) : (
          <>
            <div className="meta-top">
              <span>
                Meta: {fondo.metaMeses} {fondo.metaMeses === 1 ? "mes" : "meses"} de gastos fijos
              </span>
              <span className="cifras tabular">
                S/ {FORMATO.format(fondo.saldoActual)} {fondo.metaMonto > 0 ? `/ S/ ${FORMATO.format(fondo.metaMonto)}` : ""}
              </span>
            </div>
            {fondo.metaMonto > 0 ? (
              <>
                <div className="meta-bar-track">
                  <div className="meta-bar-fill" style={{ width: `${Math.min(100, (fondo.saldoActual / fondo.metaMonto) * 100)}%` }} />
                </div>
                <p className="meta-note">
                  {Math.min(100, (fondo.saldoActual / fondo.metaMonto) * 100).toFixed(0)}% completado · guardado en{" "}
                  {fondo.cuenta.nombre}.
                </p>
              </>
            ) : (
              <p className="meta-note">
                Todavía no hay gasto categorizado como "fijos" este mes — la meta en soles se calcula en cuanto haya.
              </p>
            )}
          </>
        )}
      </div>

      {modalAbierto && (
        <Modal onClose={() => setModalAbierto(false)}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            Fondo de emergencia
          </h2>
          <form action={handleSubmit}>
            <div className="field">
              <label htmlFor="cuentaId">Cuenta donde guardas el fondo</label>
              <select id="cuentaId" name="cuentaId" required defaultValue={fondo?.cuenta.id ?? ""}>
                <option value="" disabled>
                  Selecciona una cuenta
                </option>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="metaMeses">Meta (meses de gastos fijos)</label>
              <input
                id="metaMeses"
                name="metaMeses"
                type="number"
                step="0.5"
                min="0.5"
                defaultValue={fondo?.metaMeses ?? 3}
                required
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setModalAbierto(false)} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
