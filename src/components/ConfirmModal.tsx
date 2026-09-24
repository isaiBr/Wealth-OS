"use client";

import { Modal } from "./Modal";

interface Props {
  titulo: string;
  mensaje?: string;
  textoConfirmar?: string;
  confirmando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/** Confirmación reutilizable antes de cualquier borrado en la app — ver Fase 7 del plan de correcciones. */
export function ConfirmModal({
  titulo,
  mensaje,
  textoConfirmar = "Eliminar",
  confirmando = false,
  onConfirmar,
  onCancelar,
}: Props) {
  return (
    <Modal onClose={onCancelar}>
      <h2 className="serif" style={{ fontSize: 19, marginBottom: 12 }}>
        {titulo}
      </h2>
      {mensaje && (
        <p className="section-sub" style={{ marginTop: 0, marginBottom: 16 }}>
          {mensaje}
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onCancelar} disabled={confirmando}>
          Cancelar
        </button>
        <button type="button" className="btn-danger" onClick={onConfirmar} disabled={confirmando}>
          {confirmando ? "Eliminando..." : textoConfirmar}
        </button>
      </div>
    </Modal>
  );
}
