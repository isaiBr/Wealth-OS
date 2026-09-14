"use server";

import { revalidatePath } from "next/cache";
import { crearCuenta, alternarDestacada, actualizarBilletera, configurarFondoEmergencia } from "@/db/queries";

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

export async function actualizarBilleteraAction(formData: FormData) {
  const cuentaId = parseInt(String(formData.get("cuentaId") ?? ""), 10);
  const valor = String(formData.get("billetera") ?? "");
  const billetera = valor === "yape" || valor === "plin" ? valor : null;

  if (Number.isNaN(cuentaId)) throw new Error("Cuenta inválida");

  await actualizarBilletera(cuentaId, billetera);
  revalidatePath("/cuentas");
  revalidatePath("/");
}

export async function configurarFondoEmergenciaAction(formData: FormData) {
  const cuentaId = parseInt(String(formData.get("cuentaId") ?? ""), 10);
  const metaMeses = parseFloat(String(formData.get("metaMeses") ?? ""));

  if (Number.isNaN(cuentaId) || Number.isNaN(metaMeses) || metaMeses <= 0) {
    throw new Error("Datos de fondo de emergencia incompletos");
  }

  await configurarFondoEmergencia({ cuentaId, metaMeses });
  revalidatePath("/cuentas");
  revalidatePath("/");
}
