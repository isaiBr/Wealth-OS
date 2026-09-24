"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import {
  crearCuentaAction,
  alternarDestacadaAction,
  editarCuentaAction,
  ajustarSaldoCuentaAction,
  agregarIdentificadorAction,
  eliminarIdentificadorAction,
} from "./actions";

interface CuentaConSaldo {
  id: number;
  nombre: string;
  banco: string;
  tipo: string;
  saldo: number;
  destacada: boolean;
  billetera: string | null;
}

interface Identificador {
  id: number;
  ultimosDigitos: string;
}

export function CuentasView({
  cuentas,
  identificadoresPorCuenta,
}: {
  cuentas: CuentaConSaldo[];
  identificadoresPorCuenta: Record<number, Identificador[]>;
}) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editandoCuenta, setEditandoCuenta] = useState<CuentaConSaldo | null>(null);
  const [corrigiendoSaldo, setCorrigiendoSaldo] = useState(false);
  const [nuevoDigitos, setNuevoDigitos] = useState("");
  const [guardandoDigitos, setGuardandoDigitos] = useState(false);
  const [errorDigitos, setErrorDigitos] = useState<string | null>(null);
  const [eliminandoDigitosId, setEliminandoDigitosId] = useState<number | null>(null);

  async function handleSubmit(formData: FormData) {
    setGuardando(true);
    try {
      await crearCuentaAction(formData);
      setModalAbierto(false);
    } finally {
      setGuardando(false);
    }
  }

  async function handleEditarCuenta(formData: FormData) {
    setGuardando(true);
    try {
      await editarCuentaAction(formData);
      setEditandoCuenta(null);
    } finally {
      setGuardando(false);
    }
  }

  async function handleAjustarSaldo(formData: FormData) {
    setGuardando(true);
    try {
      await ajustarSaldoCuentaAction(formData);
      setEditandoCuenta(null);
      setCorrigiendoSaldo(false);
    } finally {
      setGuardando(false);
    }
  }

  function cerrarModalEdicion() {
    setEditandoCuenta(null);
    setCorrigiendoSaldo(false);
    setNuevoDigitos("");
    setErrorDigitos(null);
  }

  async function handleAgregarDigitos() {
    if (!editandoCuenta) return;
    setErrorDigitos(null);
    setGuardandoDigitos(true);
    try {
      await agregarIdentificadorAction(editandoCuenta.id, nuevoDigitos);
      setNuevoDigitos("");
    } catch (e) {
      setErrorDigitos(e instanceof Error ? e.message : "No se pudo agregar");
    } finally {
      setGuardandoDigitos(false);
    }
  }

  async function handleEliminarDigitos(id: number) {
    setEliminandoDigitosId(id);
    try {
      await eliminarIdentificadorAction(id);
    } finally {
      setEliminandoDigitosId(null);
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
              <span className={`banco-tag tag-${c.banco}`}>{c.banco.slice(0, 3).toUpperCase()}</span>
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
                aria-label={`Editar cuenta ${c.nombre}`}
                title="Editar nombre y billetera"
                onClick={() => {
                  setCorrigiendoSaldo(false);
                  setEditandoCuenta(c);
                }}
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

      {editandoCuenta && !corrigiendoSaldo && (
        <Modal onClose={cerrarModalEdicion}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            Editar cuenta
          </h2>
          <form action={handleEditarCuenta}>
            <input type="hidden" name="cuentaId" value={editandoCuenta.id} />
            <div className="field">
              <label htmlFor="nombre-cuenta">Nombre / alias</label>
              <input id="nombre-cuenta" name="nombre" type="text" defaultValue={editandoCuenta.nombre} required />
            </div>
            <div className="field">
              <label htmlFor="billetera">Yape/Plin ligado a esta cuenta</label>
              <select id="billetera" name="billetera" defaultValue={editandoCuenta.billetera ?? ""}>
                <option value="">Ninguna</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
              </select>
            </div>
            <div className="field">
              <label>Últimos dígitos (para identificar transacciones de correos)</label>
              {(identificadoresPorCuenta[editandoCuenta.id] ?? []).map((idf) => (
                <div key={idf.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span className="tabular" style={{ fontSize: 13.5 }}>
                    •••• {idf.ultimosDigitos}
                  </span>
                  <button
                    type="button"
                    className="edit-btn"
                    aria-label={`Quitar dígitos ${idf.ultimosDigitos}`}
                    title="Quitar"
                    disabled={eliminandoDigitosId === idf.id}
                    onClick={() => handleEliminarDigitos(idf.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="1234"
                  aria-label="Nuevos últimos dígitos"
                  value={nuevoDigitos}
                  onChange={(e) => setNuevoDigitos(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                  style={{ width: 90 }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={nuevoDigitos.length !== 4 || guardandoDigitos}
                  onClick={handleAgregarDigitos}
                >
                  {guardandoDigitos ? "Agregando..." : "+ Agregar"}
                </button>
              </div>
              {errorDigitos && (
                <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{errorDigitos}</p>
              )}
            </div>
            <button
              type="button"
              className="text-link"
              style={{ marginBottom: 16 }}
              onClick={() => setCorrigiendoSaldo(true)}
            >
              Corregir saldo actual →
            </button>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={cerrarModalEdicion} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editandoCuenta && corrigiendoSaldo && (
        <Modal onClose={cerrarModalEdicion}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            Corregir saldo de {editandoCuenta.nombre}
          </h2>
          <form action={handleAjustarSaldo}>
            <input type="hidden" name="cuentaId" value={editandoCuenta.id} />
            <p className="empty-note" style={{ padding: "0 0 10px", textAlign: "left" }}>
              Saldo actual calculado: S/ {editandoCuenta.saldo.toFixed(2)}. Se registra un movimiento de ajuste
              por la diferencia — queda visible en Movimientos, no se pierde el rastro.
            </p>
            <div className="field">
              <label htmlFor="saldoReal">Saldo real (S/)</label>
              <input
                id="saldoReal"
                name="saldoReal"
                type="number"
                step="0.01"
                defaultValue={editandoCuenta.saldo.toFixed(2)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="nota">Nota (obligatoria)</label>
              <input id="nota" name="nota" type="text" placeholder="Por qué se corrige" required />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setCorrigiendoSaldo(false)} disabled={guardando}>
                ← Volver
              </button>
              <button type="submit" className="btn-primary" disabled={guardando}>
                {guardando ? "Guardando..." : "Corregir saldo"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
