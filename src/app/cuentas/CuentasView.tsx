"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { crearCuentaAction, alternarDestacadaAction, actualizarBilleteraAction } from "./actions";

interface CuentaConSaldo {
  id: number;
  nombre: string;
  banco: string;
  tipo: string;
  saldo: number;
  destacada: boolean;
  billetera: string | null;
}

export function CuentasView({ cuentas }: { cuentas: CuentaConSaldo[] }) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editandoBilletera, setEditandoBilletera] = useState<CuentaConSaldo | null>(null);

  async function handleSubmit(formData: FormData) {
    setGuardando(true);
    try {
      await crearCuentaAction(formData);
      setModalAbierto(false);
    } finally {
      setGuardando(false);
    }
  }

  async function handleSubmitBilletera(formData: FormData) {
    setGuardando(true);
    try {
      await actualizarBilleteraAction(formData);
      setEditandoBilletera(null);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="toolbar-row">
        <span className="section-title">Cuentas conectadas</span>
        <button className="btn-add" type="button" onClick={() => setModalAbierto(true)}>
          + Agregar cuenta
        </button>
      </div>
      <p className="empty-note" style={{ padding: "0 0 10px", textAlign: "left" }}>
        La estrella marca qué cuentas aparecen en el resumen de Inicio.
      </p>

      <div className="cuentas">
        {cuentas.length === 0 && <p className="empty-note">Todavía no tienes ninguna cuenta registrada.</p>}
        {cuentas.map((c) => (
          <div className="cuenta" key={c.id}>
            <div className="banco">
              <button
                type="button"
                className="edit-btn"
                aria-pressed={c.destacada}
                aria-label={c.destacada ? "Quitar de destacadas" : "Marcar como destacada"}
                title={c.destacada ? "Quitar de destacadas" : "Marcar como destacada"}
                onClick={() => alternarDestacadaAction(c.id, !c.destacada)}
                style={{ color: c.destacada ? "var(--accent-strong)" : undefined, borderColor: c.destacada ? "var(--accent-strong)" : undefined }}
              >
                {c.destacada ? "★" : "☆"}
              </button>
              <span className="banco-tag">{c.banco.slice(0, 3).toUpperCase()}</span>
              <div className="cuenta-info">
                <div className="nombre-cuenta">
                  {c.nombre}
                  {c.billetera && <span className={`wallet-tag tag-${c.billetera}`}>{c.billetera === "yape" ? "Yape" : "Plin"}</span>}
                </div>
              </div>
            </div>
            <div className="row-right">
              <div className="saldo tabular">S/ {c.saldo.toFixed(2)}</div>
              <button
                type="button"
                className="edit-btn"
                aria-label={`Editar billetera de ${c.nombre}`}
                title="Billetera vinculada (Yape/Plin)"
                onClick={() => setEditandoBilletera(c)}
              >
                ✎
              </button>
            </div>
          </div>
        ))}
      </div>

      {modalAbierto && (
        <Modal onClose={() => setModalAbierto(false)}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            Agregar cuenta
          </h2>
          <form action={handleSubmit}>
            <div className="field">
              <label htmlFor="nombre">Nombre / alias</label>
              <input id="nombre" name="nombre" type="text" placeholder="Cuenta Simple" required />
            </div>
            <div className="field">
              <label htmlFor="banco">Banco</label>
              <select id="banco" name="banco" required defaultValue="">
                <option value="" disabled>
                  Selecciona un banco
                </option>
                <option value="interbank">Interbank</option>
                <option value="bcp">BCP</option>
                <option value="pichincha">Banco Pichincha</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="tipo">Tipo</label>
              <select id="tipo" name="tipo" required defaultValue="ahorro">
                <option value="ahorro">Ahorro</option>
                <option value="corriente">Corriente</option>
                <option value="tarjeta_credito">Tarjeta de crédito</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="saldoInicial">Saldo inicial (S/)</label>
              <input id="saldoInicial" name="saldoInicial" type="number" step="0.01" defaultValue="0" required />
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

      {editandoBilletera && (
        <Modal onClose={() => setEditandoBilletera(null)}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            Billetera vinculada — {editandoBilletera.nombre}
          </h2>
          <form action={handleSubmitBilletera}>
            <input type="hidden" name="cuentaId" value={editandoBilletera.id} />
            <div className="field">
              <label htmlFor="billetera">Yape/Plin ligado a esta cuenta</label>
              <select id="billetera" name="billetera" defaultValue={editandoBilletera.billetera ?? ""}>
                <option value="">Ninguna</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditandoBilletera(null)} disabled={guardando}>
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
