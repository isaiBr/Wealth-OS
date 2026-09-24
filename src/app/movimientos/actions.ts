"use server";

import { revalidatePath } from "next/cache";
import {
  actualizarTransaccion,
  crearTransaccionManual,
  obtenerTransaccion,
  eliminarTransaccion,
  guardarOActualizarRegla,
  obtenerConfiguracionIA,
  transaccionesDelMes,
  tagsPorTransaccion,
  alternarTagDeTransaccion,
  crearTag,
  type Tag,
  type FiltrosMovimientos,
} from "@/db/queries";

// Hora real al momento de registrar — antes se guardaba "T00:00:00" fijo en
// toda transacción manual, sin representar cuándo se registró de verdad.
// Se calcula en America/Lima (no la del servidor) porque en producción el
// servidor puede correr en UTC.
function horaActualPeru(): string {
  const partes = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date());
  const obtener = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "00";
  return `${obtener("hour")}:${obtener("minute")}:${obtener("second")}`;
}

// Las etiquetas siguen sin editarse acá — viven en el picker rápido de la
// fila (ver alternarTagAction abajo), así no hace falta abrir el formulario
// completo solo para eso. "Sin contabilizar" sí se edita acá (ver excluida).
function leerCampos(formData: FormData) {
  const cuentaId = Number(formData.get("cuentaId"));
  const tipo = String(formData.get("tipo") ?? "");
  const monto = parseFloat(String(formData.get("monto")));
  const comercio = String(formData.get("comercio") ?? "").trim();
  const categoriaIdRaw = formData.get("categoriaId");
  const categoriaId = categoriaIdRaw && categoriaIdRaw !== "" ? Number(categoriaIdRaw) : null;
  const fechaInput = String(formData.get("fecha") ?? "");
  const excluida = formData.get("excluida") === "on";

  if (!cuentaId || !tipo || !monto || Number.isNaN(monto) || !comercio || !fechaInput) {
    throw new Error("Datos de transacción incompletos");
  }

  return { cuentaId, tipo, monto, comercio, categoriaId, excluida, fecha: `${fechaInput}T${horaActualPeru()}` };
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

  await actualizarTransaccion({ id, ...campos });

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

export async function eliminarTransaccionAction(id: number) {
  try {
    await eliminarTransaccion(id);
  } catch {
    // La única FK que puede bloquear el borrado: esta transacción es el
    // origen de una compra en cuotas (transaccionOrigenId) — el mensaje
    // genérico del driver no dice eso, así que se traduce acá.
    throw new Error("No se puede eliminar: está vinculada a una compra en cuotas.");
  }
  revalidatePath("/movimientos");
  revalidatePath("/presupuesto");
  revalidatePath("/");
}

export async function obtenerTransaccionesAction(mes: string, offset: number, filtros?: FiltrosMovimientos) {
  const transacciones = await transaccionesDelMes(mes, 50, offset, filtros);
  const tagsPorTx = await tagsPorTransaccion(transacciones.map((t) => t.id));
  return { transacciones, tagsPorTx };
}

export async function alternarTagAction(transaccionId: number, tagId: number, activo: boolean) {
  await alternarTagDeTransaccion(transaccionId, tagId, activo);
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
