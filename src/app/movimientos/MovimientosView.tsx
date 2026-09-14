"use client";

import { useState } from "react";
import { TransaccionForm } from "@/components/TransaccionForm";
import type { Cuenta, Categoria, Transaccion } from "@/db/queries";

interface Props {
  cuentas: Cuenta[];
  categorias: Categoria[];
  transacciones: Transaccion[];
}

const FORMATO_DIA = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short" });
const FORMATO_MONTO = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatHora(fechaIso: string): string {
  return new Date(fechaIso).toLocaleTimeString("es-PE", { hour: "numeric", minute: "2-digit", hour12: true });
}

function etiquetaDia(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  const mismodia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (mismodia(fecha, hoy)) return "Hoy";
  if (mismodia(fecha, ayer)) return "Ayer";
  return FORMATO_DIA.format(fecha);
}

export function MovimientosView({ cuentas, categorias, transacciones }: Props) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Transaccion | undefined>(undefined);

  const cuentaPorId = new Map(cuentas.map((c) => [c.id, c]));
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));

  const grupos = new Map<string, Transaccion[]>();
  for (const t of transacciones) {
    const dia = t.fecha.slice(0, 10);
    if (!grupos.has(dia)) grupos.set(dia, []);
    grupos.get(dia)!.push(t);
  }
  const diasOrdenados = Array.from(grupos.keys()).sort((a, b) => (a < b ? 1 : -1));

  function abrirEdicion(t: Transaccion) {
    setEditando(t);
    setModalAbierto(true);
  }

  function abrirCreacion() {
    setEditando(undefined);
    setModalAbierto(true);
  }

  return (
    <>
      <div className="toolbar-row">
        <span className="section-sub">
          {transacciones.length} movimiento{transacciones.length === 1 ? "" : "s"} este mes
        </span>
        <button
          className="btn-add"
          type="button"
          onClick={abrirCreacion}
          disabled={cuentas.length === 0}
          title={cuentas.length === 0 ? "Primero crea una cuenta en la pestaña Cuentas" : undefined}
        >
          + Agregar gasto manual
        </button>
      </div>

      <div className="card" style={{ padding: "6px 18px" }}>
        {diasOrdenados.length === 0 && (
          <p className="empty-note">
            Sin movimientos todavía. {cuentas.length === 0 && "Crea una cuenta primero en la pestaña Cuentas."}
          </p>
        )}
        {diasOrdenados.map((dia) => (
          <div key={dia}>
            <div className="tx-day-label">{etiquetaDia(grupos.get(dia)![0].fecha)}</div>
            {grupos.get(dia)!.map((t) => {
              const cuenta = cuentaPorId.get(t.cuentaId);
              const categoria = t.categoriaId ? categoriaPorId.get(t.categoriaId) : undefined;
              const esIngreso = t.tipo === "ingreso" || t.tipo === "devolucion";
              return (
                <div className={`tx${t.esTransferenciaInterna ? " transfer" : ""}`} key={t.id}>
                  <div className="tx-left">
                    <div className="tx-info">
                      <button className="tx-merchant" type="button" onClick={() => abrirEdicion(t)}>
                        {t.comercio || "(sin descripción)"}
                      </button>
                      <div className="tx-meta">
                        {cuenta && <span className="banco-tag">{cuenta.banco.slice(0, 3).toUpperCase()}</span>}
                        <span className="tx-hours">{formatHora(t.fecha)}</span>
                        {t.esTransferenciaInterna ? (
                          <span className="tx-cat-pill transfer">Transferencia interna</span>
                        ) : (
                          <span className="tx-cat-pill">{categoria?.nombre ?? "Sin categoría"}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={`tx-amount tabular${esIngreso ? " income" : ""}`}>
                    {esIngreso ? "+ " : "− "}S/ {FORMATO_MONTO.format(t.monto)}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {modalAbierto && (
        <TransaccionForm
          cuentas={cuentas}
          categorias={categorias}
          transaccion={editando}
          onClose={() => setModalAbierto(false)}
        />
      )}
    </>
  );
}
