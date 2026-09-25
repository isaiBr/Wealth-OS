"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/Modal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { RowMenu } from "@/components/RowMenu";
import { ICONO_TACHO } from "@/components/icons";
import {
  alternarPagoCuotaMesAction,
  editarCuotasPagadasAction,
  crearCompraCuotasAction,
  eliminarCompraCuotasAction,
} from "./actions";
import type { CuotaActiva } from "@/db/queries";

const FORMATO = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FORMATO_MES = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" });
const FORMATO_FECHA_LARGA = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long" });

const ICONO_CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12l5 5L20 6" />
  </svg>
);

const ICONO_ALERTA = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
    <path d="M12 9v4M12 17h.01M10.3 3.9 2.7 17.1a1.8 1.8 0 0 0 1.6 2.7h15.4a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" />
  </svg>
);

function nombreMes(mesISO: string): string {
  const [anio, mes] = mesISO.split("-").map(Number);
  const nombre = FORMATO_MES.format(new Date(anio, mes - 1, 1));
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

// "YYYY-MM-DD" -> días de diferencia con hoy (positivo = en el futuro)
function diasHasta(fechaISO: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return Math.round((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function fechaLarga(fechaISO: string): string {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  return FORMATO_FECHA_LARGA.format(new Date(anio, mes - 1, dia));
}

export function CuotasView({ cuotas, totalMensual }: { cuotas: CuotaActiva[]; totalMensual: number }) {
  const [pendientes, setPendientes] = useState<Set<number>>(new Set());
  const [, startTransition] = useTransition();
  const [editando, setEditando] = useState<CuotaActiva | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<CuotaActiva | null>(null);
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);

  function alternar(c: CuotaActiva) {
    setPendientes((prev) => new Set(prev).add(c.id));
    startTransition(async () => {
      await alternarPagoCuotaMesAction(c.id, c.mesActual, !c.pagadaEsteMes);
      setPendientes((prev) => {
        const copia = new Set(prev);
        copia.delete(c.id);
        return copia;
      });
    });
  }

  async function handleSubmit(formData: FormData) {
    if (!editando) return;
    setGuardando(true);
    try {
      const nuevoTotal = Number(formData.get("cuotasPagadas"));
      const nuevoComercio = String(formData.get("comercio") ?? "");
      const diaPagoRaw = String(formData.get("diaPago") ?? "").trim();
      const nuevoDiaPago = diaPagoRaw ? Number(diaPagoRaw) : undefined;
      await editarCuotasPagadasAction(editando.id, nuevoTotal, nuevoComercio, nuevoDiaPago);
      setEditando(null);
    } finally {
      setGuardando(false);
    }
  }

  async function handleCrear(formData: FormData) {
    setCreando(true);
    try {
      await crearCompraCuotasAction(formData);
      setAgregando(false);
    } finally {
      setCreando(false);
    }
  }

  async function handleEliminar(c: CuotaActiva) {
    setEliminandoId(c.id);
    try {
      await eliminarCompraCuotasAction(c.id);
      setConfirmandoEliminar(null);
    } finally {
      setEliminandoId(null);
    }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: cuotas.length > 0 ? 12 : 8 }}>
        <button type="button" className="text-link" onClick={() => setAgregando(true)}>
          + Agregar compra en cuotas
        </button>
      </div>

      {cuotas.length === 0 && <p className="empty-note">Sin compras en cuotas activas.</p>}

      {cuotas.map((c) => {
        const pct = (c.cuotasPagadasTotal / c.totalCuotas) * 100;
        return (
          <div className="cuota-row" key={c.id}>
            <div className="cuota-top">
              <span className="comercio">{c.comercio}</span>
              <span className="monto tabular">S/ {FORMATO.format(c.montoCuota)}/mes</span>
            </div>
            <div className="cuota-meta">
              <div className="cuota-progress">
                <i style={{ width: `${pct}%` }} />
              </div>
              <span className="n">
                cuota {c.cuotasPagadasTotal}/{c.totalCuotas}
                {c.diaPago !== null && ` · día ${c.diaPago}`}
              </span>
              <RowMenu
                ariaLabel={`Más acciones para ${c.comercio}`}
                actions={[
                  { label: "Corregir cuotas pagadas", icon: "✎", onClick: () => setEditando(c) },
                  {
                    label: "Eliminar",
                    icon: ICONO_TACHO,
                    danger: true,
                    disabled: eliminandoId === c.id,
                    onClick: () => setConfirmandoEliminar(c),
                  },
                ]}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              <span
                style={{
                  fontSize: 11.5,
                  color: c.pagadaEsteMes ? "var(--accent-strong)" : "var(--ink-muted)",
                }}
              >
                {nombreMes(c.mesActual)}: {c.pagadaEsteMes ? "Pagada" : "Pendiente"}
              </span>
              <button
                className="edit-btn"
                type="button"
                aria-label={
                  c.pagadaEsteMes
                    ? `Deshacer el pago de ${c.comercio} de este mes`
                    : `Marcar cuota de ${c.comercio} como pagada este mes`
                }
                title={c.pagadaEsteMes ? "Deshacer" : "Marcar como pagada"}
                disabled={pendientes.has(c.id)}
                onClick={() => alternar(c)}
              >
                {c.pagadaEsteMes ? "↺" : ICONO_CHECK}
              </button>
            </div>
            {c.vencidaEsteMes && (
              <div className="cat-flag over">
                {ICONO_ALERTA}Venció el {c.diaPago} y sigue sin marcarse pagada
              </div>
            )}
            {!c.vencidaEsteMes && !c.pagadaEsteMes && c.proximaFechaPago && diasHasta(c.proximaFechaPago) <= 5 && (
              <div className="cat-flag warn">
                {ICONO_ALERTA}
                {diasHasta(c.proximaFechaPago) === 0
                  ? `Vence hoy (${fechaLarga(c.proximaFechaPago)})`
                  : `Vence en ${diasHasta(c.proximaFechaPago)} día${diasHasta(c.proximaFechaPago) === 1 ? "" : "s"} (${fechaLarga(c.proximaFechaPago)})`}
              </div>
            )}
          </div>
        );
      })}
      {cuotas.length > 0 && (
        <div className="cuota-total">
          <span>Total pendiente este mes</span>
          <span className="valor tabular">S/ {FORMATO.format(totalMensual)}</span>
        </div>
      )}
      {cuotas.length > 0 && (
        <div className="cuota-note">
          Marca cada cuota a mano acá, o de una vez al registrar el pago en Movimientos con &ldquo;¿Esto cubre
          algo?&rdquo; → una cuota de tarjeta (soporta elegir varias a la vez).
        </div>
      )}

      {editando && (
        <Modal onClose={() => setEditando(null)}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            Corregir cuotas pagadas — {editando.comercio}
          </h2>
          <form action={handleSubmit}>
            <div className="field">
              <label htmlFor="comercio">Nombre de la cuota</label>
              <input id="comercio" name="comercio" type="text" defaultValue={editando.comercio} required />
            </div>
            <div className="field">
              <label htmlFor="cuotasPagadas">
                Cuotas pagadas de {editando.totalCuotas} totales
              </label>
              <input
                id="cuotasPagadas"
                name="cuotasPagadas"
                type="number"
                min="0"
                max={editando.totalCuotas}
                defaultValue={editando.cuotasPagadasTotal}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="diaPago">Día de pago (1-31)</label>
              <input
                id="diaPago"
                name="diaPago"
                type="number"
                min="1"
                max="31"
                step="1"
                defaultValue={editando.diaPago ?? ""}
                placeholder="Sin configurar todavía"
              />
            </div>
            <p className="section-sub" style={{ marginTop: 0 }}>
              El estado de &ldquo;{nombreMes(editando.mesActual)}&rdquo; (pagada/pendiente) no se toca acá — usá el
              botón de la fila para eso.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditando(null)} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {agregando && (
        <Modal onClose={() => setAgregando(false)}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            Agregar compra en cuotas
          </h2>
          <form action={handleCrear}>
            <div className="field">
              <label htmlFor="comercio-nuevo">Comercio</label>
              <input id="comercio-nuevo" name="comercio" type="text" placeholder="Ripley" required />
            </div>
            <div className="field">
              <label htmlFor="montoTotal">Monto total (S/)</label>
              <input id="montoTotal" name="montoTotal" type="number" step="0.01" min="0.01" required />
            </div>
            <div className="field">
              <label htmlFor="totalCuotas">Cantidad de cuotas</label>
              <input id="totalCuotas" name="totalCuotas" type="number" min="1" step="1" required />
            </div>
            <div className="field">
              <label htmlFor="fechaCompra">Fecha de la compra</label>
              <input
                id="fechaCompra"
                name="fechaCompra"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="diaPago-nuevo">Día de pago (1-31)</label>
              <input id="diaPago-nuevo" name="diaPago" type="number" min="1" max="31" step="1" required />
            </div>
            <p className="section-sub" style={{ marginTop: 0 }}>
              Tracker 100% manual, sin ligar a ninguna tarjeta/cuenta. El monto de cada cuota se calcula solo (monto
              total ÷ cantidad de cuotas); el día de pago activa el aviso de vencimiento.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setAgregando(false)} disabled={creando}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={creando}>
                {creando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirmandoEliminar && (
        <ConfirmModal
          titulo={`¿Eliminar "${confirmandoEliminar.comercio}"?`}
          mensaje="Se borra el tracker completo, incluido el historial de cuotas ya marcadas pagadas. No se puede deshacer."
          confirmando={eliminandoId === confirmandoEliminar.id}
          onConfirmar={() => handleEliminar(confirmandoEliminar)}
          onCancelar={() => setConfirmandoEliminar(null)}
        />
      )}
    </>
  );
}
