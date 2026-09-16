"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { crearTransaccionAction, actualizarTransaccionAction } from "@/app/movimientos/actions";
import type { Cuenta, Categoria, Transaccion } from "@/db/queries";

interface Props {
  cuentas: Cuenta[];
  categorias: Categoria[];
  transaccion?: Transaccion; // si viene, es edición
  onClose: () => void;
}

export function TransaccionForm({ cuentas, categorias, transaccion, onClose }: Props) {
  const [guardando, setGuardando] = useState(false);
  const esEdicion = !!transaccion;

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
          <label htmlFor="categoriaId">Categoría</label>
          <select id="categoriaId" name="categoriaId" defaultValue={transaccion?.categoriaId ?? ""}>
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
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
