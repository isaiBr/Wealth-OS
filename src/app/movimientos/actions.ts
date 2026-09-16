"use server";

import { revalidatePath } from "next/cache";
import { actualizarTransaccion, crearTransaccionManual } from "@/db/queries";

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
  revalidatePath("/movimientos");
  revalidatePath("/");
}

export async function actualizarTransaccionAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) throw new Error("Falta el id de la transacción");
  const campos = leerCampos(formData);
  await actualizarTransaccion({ id, ...campos });
  revalidatePath("/movimientos");
  revalidatePath("/");
}
