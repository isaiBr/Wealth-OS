"use server";

import { revalidatePath } from "next/cache";
import {
  actualizarTransaccion,
  crearTransaccionManual,
  obtenerTransaccion,
  guardarOActualizarRegla,
  obtenerConfiguracionIA,
  transaccionesDelMes,
  tagsPorTransaccion,
  alternarTagDeTransaccion,
  alternarExcluida,
  crearTag,
  type Tag,
} from "@/db/queries";

// Tags y "sin contabilizar" ya NO se editan acá — viven en el picker rápido
// de la fila (ver alternarTagAction/alternarExcluidaAction abajo), así no
// hace falta abrir el formulario completo solo para eso.
function leerCampos(formData: FormData) {
  const cuentaId = Number(formData.get("cuentaId"));
  const tipo = String(formData.get("tipo") ?? "");
  const monto = parseFloat(String(formData.get("monto")));
  const comercio = String(formData.get("comercio") ?? "").trim();
  const categoriaIdRaw = formData.get("categoriaId");
  const categoriaId = categoriaIdRaw && categoriaIdRaw !== "" ? Number(categoriaIdRaw) : null;
  const fechaInput = String(formData.get("fecha") ?? "");

  if (!cuentaId || !tipo || !monto || Number.isNaN(monto) || !comercio || !fechaInput) {
    throw new Error("Datos de transacción incompletos");
  }

  return { cuentaId, tipo, monto, comercio, categoriaId, fecha: `${fechaInput}T00:00:00` };
}

export async function crearTransaccionAction(formData: FormData) {
  const campos = leerCampos(formData);
  if (campos.tipo !== "compra" && campos.tipo !== "ingreso") {
    throw new Error("Un gasto manual solo puede ser 'compra' o 'ingreso'");
  }
  await crearTransaccionManual({ ...campos, tipo: campos.tipo });

  // Aprendizaje: guardar regla de categorización si se asignó una categoría
  // (salvo que el usuario lo haya apagado en Configuración)
  const { aprenderReglasNuevas } = await obtenerConfiguracionIA();
  if (aprenderReglasNuevas && campos.categoriaId !== null && campos.comercio.trim() !== "") {
    await guardarOActualizarRegla(campos.comercio, campos.categoriaId, "manual");
  }

  revalidatePath("/movimientos");
  revalidatePath("/");
}

export async function actualizarTransaccionAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) throw new Error("Falta el id de la transacción");
  const campos = leerCampos(formData);

  const transaccionOriginal = await obtenerTransaccion(id);

  // Preservar la hora original si la fecha no cambió
  const fechaInputSolo = String(formData.get("fecha") ?? "").slice(0, 10);
  if (transaccionOriginal) {
    const fechaOriginalSolo = transaccionOriginal.fecha.slice(0, 10);
    const horaOriginal = transaccionOriginal.fecha.slice(10); // "T00:00:00" o similar
    if (fechaInputSolo === fechaOriginalSolo) {
      campos.fecha = `${fechaInputSolo}${horaOriginal}`;
    }
  }

  // El form ya no trae "excluida" — se preserva el valor actual tal cual
  // (se gestiona desde el picker rápido, ver alternarExcluidaAction).
  await actualizarTransaccion({ id, ...campos, excluida: transaccionOriginal?.excluida ?? false });

  // Aprendizaje: guardar regla de categorización si se asignó una categoría
  // (salvo que el usuario lo haya apagado en Configuración)
  const { aprenderReglasNuevas } = await obtenerConfiguracionIA();
  if (aprenderReglasNuevas && campos.categoriaId !== null && campos.comercio.trim() !== "") {
    const eraSugerenciaIA =
      transaccionOriginal?.categoriaConfirmada === false &&
      transaccionOriginal?.categoriaId === campos.categoriaId;
    await guardarOActualizarRegla(campos.comercio, campos.categoriaId, eraSugerenciaIA ? "ia" : "manual");
  }

  revalidatePath("/movimientos");
  revalidatePath("/");
}

export async function obtenerTransaccionesAction(mes: string, offset: number) {
  const transacciones = await transaccionesDelMes(mes, 50, offset);
  const tagsPorTx = await tagsPorTransaccion(transacciones.map((t) => t.id));
  return { transacciones, tagsPorTx };
}

export async function alternarTagAction(transaccionId: number, tagId: number, activo: boolean) {
  await alternarTagDeTransaccion(transaccionId, tagId, activo);
  revalidatePath("/movimientos");
  revalidatePath("/presupuesto");
  revalidatePath("/");
}

export async function alternarExcluidaAction(transaccionId: number, excluida: boolean) {
  await alternarExcluida(transaccionId, excluida);
  revalidatePath("/movimientos");
  revalidatePath("/presupuesto");
  revalidatePath("/");
}

// Crea la etiqueta (o reusa una existente con el mismo nombre, ver crearTag)
// y la prende de una en el movimiento — el picker rápido de Movimientos no
// necesita pasar por Configuración solo para dar de alta una etiqueta nueva.
// Eliminar una etiqueta sigue viviendo exclusivamente en Configuración.
export async function crearYAsignarTagAction(transaccionId: number, nombre: string): Promise<Tag> {
  const tag = await crearTag(nombre);
  await alternarTagDeTransaccion(transaccionId, tag.id, true);
  revalidatePath("/movimientos");
  revalidatePath("/presupuesto");
  revalidatePath("/configuracion");
  revalidatePath("/");
  return tag;
}
