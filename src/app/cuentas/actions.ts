"use server";

import { revalidatePath } from "next/cache";
import {
  crearCuenta,
  alternarDestacada,
  actualizarBilletera,
  renombrarCuenta,
  configurarFondoEmergencia,
  crearCobranza,
  editarCobranza,
  marcarCobranzaCobrada,
  eliminarCobranza,
  crearDeudaManual,
  editarMontoDeudaManual,
  marcarDeudaManualPagada,
  eliminarDeudaManual,
  corregirDeudaTarjeta,
} from "@/db/queries";

function redondear(monto: number): number {
  return Math.round(monto * 100) / 100;
}

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

export async function editarCuentaAction(formData: FormData) {
  const cuentaId = parseInt(String(formData.get("cuentaId") ?? ""), 10);
  const nombre = String(formData.get("nombre") ?? "").trim();
  const valor = String(formData.get("billetera") ?? "");
  const billetera = valor === "yape" || valor === "plin" ? valor : null;

  if (Number.isNaN(cuentaId) || !nombre) throw new Error("Datos de cuenta inválidos");

  await renombrarCuenta(cuentaId, nombre);
  await actualizarBilletera(cuentaId, billetera);
  revalidatePath("/cuentas");
  revalidatePath("/movimientos");
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

export async function crearCobranzaAction(formData: FormData) {
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const montoEsperado = parseFloat(String(formData.get("montoEsperado") ?? ""));

  if (!descripcion || Number.isNaN(montoEsperado) || montoEsperado <= 0) {
    throw new Error("Datos de cobranza incompletos");
  }

  await crearCobranza({ descripcion, montoEsperado });
  revalidatePath("/cuentas");
}

export async function editarCobranzaAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const montoEsperado = parseFloat(String(formData.get("montoEsperado") ?? ""));

  if (!id || !descripcion || Number.isNaN(montoEsperado) || montoEsperado <= 0) {
    throw new Error("Datos de cobranza incompletos");
  }

  await editarCobranza(id, { descripcion, montoEsperado: redondear(montoEsperado) });
  revalidatePath("/cuentas");
}

export async function marcarCobranzaCobradaAction(id: number, cobrado: boolean) {
  await marcarCobranzaCobrada(id, cobrado);
  revalidatePath("/cuentas");
}

export async function eliminarCobranzaAction(id: number) {
  await eliminarCobranza(id);
  revalidatePath("/cuentas");
}

export async function crearDeudaManualAction(formData: FormData) {
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const montoAdeudado = parseFloat(String(formData.get("montoAdeudado") ?? ""));

  if (!descripcion || Number.isNaN(montoAdeudado) || montoAdeudado <= 0) {
    throw new Error("Datos de deuda incompletos");
  }

  await crearDeudaManual({ descripcion, montoAdeudado });
  revalidatePath("/cuentas");
}

export async function editarMontoDeudaManualAction(id: number, montoAdeudado: number) {
  if (Number.isNaN(montoAdeudado) || montoAdeudado < 0) throw new Error("Monto inválido");
  await editarMontoDeudaManual(id, redondear(montoAdeudado));
  revalidatePath("/cuentas");
}

export async function marcarDeudaManualPagadaAction(id: number, pagada: boolean) {
  await marcarDeudaManualPagada(id, pagada);
  revalidatePath("/cuentas");
}

export async function eliminarDeudaManualAction(id: number) {
  await eliminarDeudaManual(id);
  revalidatePath("/cuentas");
}

export async function corregirDeudaTarjetaAction(cuentaId: number, nuevaDeuda: number) {
  if (Number.isNaN(nuevaDeuda) || nuevaDeuda < 0) throw new Error("Monto de deuda inválido");
  await corregirDeudaTarjeta(cuentaId, redondear(nuevaDeuda));
  revalidatePath("/cuentas");
  revalidatePath("/");
}
