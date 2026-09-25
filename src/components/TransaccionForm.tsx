"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { ConfirmModal } from "./ConfirmModal";
import { crearTransaccionAction, actualizarTransaccionAction, eliminarTransaccionAction } from "@/app/movimientos/actions";
import type { Cuenta, Categoria, Transaccion, CuotaActiva, DeudaManual, Cobranza, MetaCompraConProgreso } from "@/db/queries";
import { BUCKETS_ORDEN, BUCKET_LABEL } from "@/logic/buckets";

const FORMATO = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type CubreTipo = "no" | "cuota" | "deuda" | "cobranza" | "meta";

interface Props {
  cuentas: Cuenta[];
  categorias: Categoria[];
  transaccion?: Transaccion; // si viene, es edición
  onClose: () => void;
  cuotasSinPagar: CuotaActiva[];
  deudasPendientes: DeudaManual[];
  cobranzasPendientes: Cobranza[];
  metas: MetaCompraConProgreso[];
}

export function TransaccionForm({
  cuentas,
  categorias,
  transaccion,
  onClose,
  cuotasSinPagar,
  deudasPendientes,
  cobranzasPendientes,
  metas,
}: Props) {
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const esEdicion = !!transaccion;

  const categoriaActual = categorias.find((c) => c.id === transaccion?.categoriaId);
  const [bucket, setBucket] = useState(categoriaActual?.bucket ?? "");
  const [categoriaId, setCategoriaId] = useState(transaccion?.categoriaId ? String(transaccion.categoriaId) : "");
  const categoriasDelBucket = categorias.filter(
    (c) => c.bucket === bucket && (!c.archivada || c.id === transaccion?.categoriaId)
  );

  // "¿Esto cubre algo?" no refleja estado guardado — es un atajo que dispara
  // una acción al guardar (ver leerCobertura/aplicarCobertura en
  // movimientos/actions.ts), no un campo persistido de la transacción. Por
  // eso arranca siempre en "no", también al editar un movimiento existente.
  const [tipo, setTipo] = useState(transaccion?.tipo === "ingreso" ? "ingreso" : "compra");
  const [cubreTipo, setCubreTipo] = useState<CubreTipo>("no");

  async function handleSubmit(formData: FormData) {
    setGuardando(true);
    try {
      if (esEdicion) {
        formData.set("id", String(transaccion!.id));
        await actualizarTransaccionAction(formData);
      } else {
        await crearTransaccionAction(formData);
      }
      onClose();
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar() {
    if (!transaccion) return;
    setErrorEliminar(null);
    setEliminando(true);
    try {
      await eliminarTransaccionAction(transaccion.id);
      onClose();
    } catch (e) {
      setErrorEliminar(e instanceof Error ? e.message : "No se pudo eliminar");
      setConfirmandoEliminar(false);
    } finally {
      setEliminando(false);
    }
  }

  const fechaDefault = transaccion ? transaccion.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10);

  // Una transacción de correo puede ser transferencia/retiro/pago_servicio/
  // devolución, no solo compra o ingreso — el selector de abajo solo cubre
  // esas dos opciones, así que forzar una de ellas al editar reescribía el
  // tipo real (ej. "devolucion" -> "compra"), lo que podía chocar con el
  // índice único (numero_operacion, tipo) contra la compra hermana del
  // mismo número de operación y tumbar la página. Para una edición sobre
  // una transacción real, el tipo original se manda tal cual, sin selector.
  const tipoEditable = !esEdicion || transaccion!.fuente === "manual";
  // "¿Esto cubre algo?" solo tiene sentido para compra/ingreso — una
  // transferencia, un pago de servicio, etc. no "cubren" nada.
  const tipoEfectivo = tipoEditable ? tipo : transaccion!.tipo;

  return (
    <Modal onClose={onClose}>
      <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
        {esEdicion ? "Editar movimiento" : "Agregar gasto manual"}
      </h2>
      <form action={handleSubmit}>
        {tipoEditable ? (
          <div className="field">
            <label htmlFor="tipo">Tipo</label>
            <select
              id="tipo"
              name="tipo"
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value);
                // Las opciones de "¿esto cubre algo?" dependen del tipo (cuota/deuda
                // para gasto, cobranza para ingreso) — sin este reset, cambiar de
                // tipo dejaba pegada una selección que ya no aplica (ej. "cobranza"
                // seleccionada al pasar de Ingreso a Gasto).
                setCubreTipo("no");
              }}
              required
            >
              <option value="compra">Gasto</option>
              <option value="ingreso">Ingreso</option>
            </select>
          </div>
        ) : (
          <input type="hidden" name="tipo" value={transaccion!.tipo} />
        )}

        <div className="field">
          <label htmlFor="monto">Monto (S/)</label>
          <input
            id="monto"
            name="monto"
            type="number"
            step="0.01"
            min="0"
            defaultValue={transaccion?.monto}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="comercio">Comercio / descripción</label>
          <input
            id="comercio"
            name="comercio"
            type="text"
            defaultValue={transaccion?.comercio ?? ""}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="cuentaId">Cuenta</label>
          <select id="cuentaId" name="cuentaId" defaultValue={transaccion?.cuentaId} required>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="fecha">Fecha</label>
          <input id="fecha" name="fecha" type="date" defaultValue={fechaDefault} required />
        </div>

        <details>
          <summary className="advanced-toggle">Más opciones (categoría, sin contabilizar, vínculos)</summary>
          <div className="advanced-body">
            <div className="field">
              <label htmlFor="categoriaBucket">Categoría — bucket</label>
              <select
                id="categoriaBucket"
                value={bucket}
                onChange={(e) => {
                  setBucket(e.target.value);
                  setCategoriaId("");
                }}
              >
                <option value="">Sin categoría</option>
                {BUCKETS_ORDEN.map((b) => (
                  <option key={b} value={b}>
                    {BUCKET_LABEL[b]}
                  </option>
                ))}
              </select>
            </div>

            {bucket && (
              <div className="field">
                <label htmlFor="categoriaId">Categoría dentro de &ldquo;{BUCKET_LABEL[bucket]}&rdquo;</label>
                <select
                  id="categoriaId"
                  name="categoriaId"
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Selecciona una categoría
                  </option>
                  {categoriasDelBucket.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="field">
              <label htmlFor="excluida" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input id="excluida" name="excluida" type="checkbox" defaultChecked={transaccion?.excluida ?? false} />
                Sin contabilizar (excluir de totales de gasto/ingreso)
              </label>
            </div>

            {(tipoEfectivo === "compra" || tipoEfectivo === "ingreso") && (
              <div className="field">
                <label htmlFor="cubreTipo">¿Este movimiento cubre algo?</label>
                <select
                  id="cubreTipo"
                  name="cubreTipo"
                  value={cubreTipo}
                  onChange={(e) => setCubreTipo(e.target.value as CubreTipo)}
                >
                  <option value="no">No</option>
                  {tipoEfectivo === "compra" && <option value="cuota">Una cuota de tarjeta</option>}
                  {tipoEfectivo === "compra" && <option value="deuda">Una deuda pendiente</option>}
                  {tipoEfectivo === "ingreso" && <option value="cobranza">Una cobranza pendiente</option>}
                  <option value="meta">Una meta de compra</option>
                </select>
              </div>
            )}

            {cubreTipo === "cuota" && (
              <div className="cover-option">
                {cuotasSinPagar.length === 0 ? (
                  <div className="section-sub" style={{ margin: 0 }}>
                    No hay cuotas activas sin pagar este mes.
                  </div>
                ) : (
                  <>
                    <div className="section-sub" style={{ margin: "0 0 4px" }}>
                      Cuotas activas este mes — elige las que cubre este pago:
                    </div>
                    {cuotasSinPagar.map((c) => (
                      <label className="cover-check-row" key={c.id}>
                        <input type="checkbox" name="cuotaIds" value={c.id} />
                        {c.comercio}
                        <span className="monto tabular">S/ {FORMATO.format(c.montoCuota)}</span>
                      </label>
                    ))}
                  </>
                )}
              </div>
            )}

            {cubreTipo === "deuda" && (
              <div className="field">
                <label htmlFor="deudaId">Deuda pendiente</label>
                <select id="deudaId" name="deudaId" required defaultValue="">
                  <option value="" disabled>
                    Selecciona una deuda
                  </option>
                  {deudasPendientes.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.descripcion} (S/ {FORMATO.format(d.montoAdeudado)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {cubreTipo === "cobranza" && (
              <div className="field">
                <label htmlFor="cobranzaId">Cobranza pendiente</label>
                <select id="cobranzaId" name="cobranzaId" required defaultValue="">
                  <option value="" disabled>
                    Selecciona una cobranza
                  </option>
                  {cobranzasPendientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.descripcion} (S/ {FORMATO.format(c.montoEsperado)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {cubreTipo === "meta" && (
              <div className="field">
                <label htmlFor="metaId">Meta de compra</label>
                <select id="metaId" name="metaId" required defaultValue="">
                  <option value="" disabled>
                    Selecciona una meta
                  </option>
                  {metas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} (S/ {FORMATO.format(m.progreso)} / S/ {FORMATO.format(m.precioObjetivo)})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </details>

        {esEdicion && (
          <p className="section-sub" style={{ marginTop: -4, marginBottom: 4 }}>
            Las etiquetas se manejan desde el botón + etiqueta de la fila, sin abrir este formulario.
          </p>
        )}

        {esEdicion && (
          <button
            type="button"
            className="text-link danger"
            style={{ marginBottom: 16 }}
            disabled={eliminando}
            onClick={() => setConfirmandoEliminar(true)}
          >
            Eliminar movimiento
          </button>
        )}
        {errorEliminar && (
          <p className="section-sub" style={{ color: "var(--danger)", marginTop: -12, marginBottom: 12 }}>
            {errorEliminar}
          </p>
        )}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>

      {confirmandoEliminar && (
        <ConfirmModal
          titulo="¿Eliminar este movimiento?"
          mensaje="No se puede deshacer."
          confirmando={eliminando}
          onConfirmar={handleEliminar}
          onCancelar={() => setConfirmandoEliminar(false)}
        />
      )}
    </Modal>
  );
}
