"use server";

import { revalidatePath } from "next/cache";
import { actualizarTransaccion, crearTransaccionManual } from "@/db/queries";

function leerCampos(formData: FormData) {
  const cuentaId = Number(formData.get("cuentaId"));
  const tipo = String(formData.get("tipo")) as "compra" | "ingreso";
  const monto = parseFloat(String(formData.get("monto")));
  const comercio = String(formData.get("comercio") ?? "").trim();
  const categoriaIdRaw = formData.get("categoriaId");
  const categoriaId = categoriaIdRaw && categoriaIdRaw !== "" ? Number(categoriaIdRaw) : null;
  const fechaInput = String(formData.get("fecha") ?? "");

  if (!cuentaId || !monto || Number.isNaN(monto) || !comercio || !fechaInput) {
    throw new Error("Datos de transacción incompletos");
  }

  return { cuentaId, tipo, monto, comercio, categoriaId, fecha: `${fechaInput}T00:00:00` };
}

export async function crearTransaccionAction(formData: FormData) {
  const campos = leerCampos(formData);
  await crearTransaccionManual(campos);
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
