"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { crearTransaccionAction, actualizarTransaccionAction, eliminarTransaccionAction } from "@/app/movimientos/actions";
import type { Cuenta, Categoria, Transaccion } from "@/db/queries";
import { BUCKETS_ORDEN, BUCKET_LABEL } from "@/logic/buckets";

interface Props {
  cuentas: Cuenta[];
  categorias: Categoria[];
  transaccion?: Transaccion; // si viene, es edición
  onClose: () => void;
}

export function TransaccionForm({ cuentas, categorias, transaccion, onClose }: Props) {
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const esEdicion = !!transaccion;

  const categoriaActual = categorias.find((c) => c.id === transaccion?.categoriaId);
  const [bucket, setBucket] = useState(categoriaActual?.bucket ?? "");
  const [categoriaId, setCategoriaId] = useState(transaccion?.categoriaId ? String(transaccion.categoriaId) : "");
  const categoriasDelBucket = categorias.filter(
    (c) => c.bucket === bucket && (!c.archivada || c.id === transaccion?.categoriaId)
  );

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

  return (
    <Modal onClose={onClose}>
      <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
        {esEdicion ? "Editar movimiento" : "Agregar gasto manual"}
      </h2>
      <form action={handleSubmit}>
        {tipoEditable ? (
          <div className="field">
            <label htmlFor="tipo">Tipo</label>
            <select id="tipo" name="tipo" defaultValue={transaccion?.tipo === "ingreso" ? "ingreso" : "compra"} required>
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
          <label htmlFor="fecha">Fecha</label>
          <input id="fecha" name="fecha" type="date" defaultValue={fechaDefault} required />
        </div>

        <div className="field">
          <label htmlFor="excluida" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input id="excluida" name="excluida" type="checkbox" defaultChecked={transaccion?.excluida ?? false} />
            Sin contabilizar (excluir de totales de gasto/ingreso)
          </label>
        </div>

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
            onClick={handleEliminar}
          >
            {eliminando ? "Eliminando..." : "Eliminar movimiento"}
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
    </Modal>
  );
}
