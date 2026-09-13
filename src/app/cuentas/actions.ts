"use server";

import { revalidatePath } from "next/cache";
import { crearCuenta, alternarDestacada } from "@/db/queries";

export async function crearCuentaAction(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const banco = String(formData.get("banco") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "").trim();
  const saldoInicial = parseFloat(String(formData.get("saldoInicial") ?? "0"));

  if (!nombre || !banco || !tipo || Number.isNaN(saldoInicial)) {
    throw new Error("Datos de cuenta incompletos");
  }

  await crearCuenta({ nombre, banco, tipo, saldoInicial });
  revalidatePath("/cuentas");
  revalidatePath("/movimientos");
  revalidatePath("/");
}

export async function alternarDestacadaAction(cuentaId: number, destacada: boolean) {
  await alternarDestacada(cuentaId, destacada);
  revalidatePath("/cuentas");
  revalidatePath("/");
}
