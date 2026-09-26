"use server";

import { revalidatePath } from "next/cache";
import {
  editarLimiteCategoria,
  alternarPagoCuotaMes,
  editarCuotasPagadas,
  crearCompraCuotas,
  eliminarCompraCuotas,
  desglosePorEtiqueta,
  crearMetaCompra,
  editarMetaCompra,
  actualizarMontoAhorradoMeta,
  cambiarEstadoMeta,
  eliminarMetaCompra,
} from "@/db/queries";
import type { NuevaMetaCompra } from "@/db/queries";

export async function editarLimiteAction(formData: FormData) {
  const categoriaId = Number(formData.get("categoriaId"));
  const raw = String(formData.get("limiteMensual") ?? "").trim();
  const limiteMensual = raw === "" ? null : parseFloat(raw);

  if (!categoriaId || (limiteMensual !== null && Number.isNaN(limiteMensual))) {
    throw new Error("Datos de límite inválidos");
  }

  await editarLimiteCategoria(categoriaId, limiteMensual);
  revalidatePath("/presupuesto");
  revalidatePath("/");
}

export async function alternarPagoCuotaMesAction(compraCuotaId: number, mes: string, pagada: boolean) {
  await alternarPagoCuotaMes(compraCuotaId, mes, pagada);
  revalidatePath("/presupuesto");
  revalidatePath("/");
}

export async function obtenerDesgloseEtiquetasAction(categoriaId: number, mes: string) {
  return desglosePorEtiqueta(categoriaId, mes);
}

export async function editarCuotasPagadasAction(
  compraCuotaId: number,
  nuevoTotal: number,
  nuevoComercio?: string,
  nuevoDiaPago?: number
) {
  if (Number.isNaN(nuevoTotal) || nuevoTotal < 0) throw new Error("Cantidad de cuotas inválida");
  const comercio = nuevoComercio?.trim();
  if (comercio !== undefined && !comercio) throw new Error("El nombre de la cuota no puede quedar vacío");
  if (nuevoDiaPago !== undefined && (Number.isNaN(nuevoDiaPago) || nuevoDiaPago < 1 || nuevoDiaPago > 31)) {
    throw new Error("El día de pago debe ser entre 1 y 31");
  }
  await editarCuotasPagadas(compraCuotaId, nuevoTotal, comercio, nuevoDiaPago);
  revalidatePath("/presupuesto");
  revalidatePath("/");
}

export async function crearCompraCuotasAction(formData: FormData) {
  const comercio = String(formData.get("comercio") ?? "").trim();
  const montoTotal = parseFloat(String(formData.get("montoTotal") ?? ""));
  const totalCuotas = parseInt(String(formData.get("totalCuotas") ?? ""), 10);
  const fechaCompra = String(formData.get("fechaCompra") ?? "").trim();
  const diaPago = parseInt(String(formData.get("diaPago") ?? ""), 10);

  if (
    !comercio ||
    Number.isNaN(montoTotal) ||
    montoTotal <= 0 ||
    !totalCuotas ||
    totalCuotas < 1 ||
    !fechaCompra ||
    Number.isNaN(diaPago) ||
    diaPago < 1 ||
    diaPago > 31
  ) {
    throw new Error("Datos de compra en cuotas incompletos");
  }

  await crearCompraCuotas({ comercio, montoTotal, totalCuotas, fechaCompra, diaPago });
  revalidatePath("/presupuesto");
  revalidatePath("/");
}

export async function eliminarCompraCuotasAction(id: number) {
  await eliminarCompraCuotas(id);
  revalidatePath("/presupuesto");
  revalidatePath("/");
}

function leerCamposMeta(formData: FormData): NuevaMetaCompra {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const precioObjetivo = parseFloat(String(formData.get("precioObjetivo") ?? ""));
  const fechaDeseadaRaw = String(formData.get("fechaDeseada") ?? "").trim();
  const metodoPago = String(formData.get("metodoPago") ?? "");

  if (!nombre || Number.isNaN(precioObjetivo) || precioObjetivo <= 0 || !metodoPago) {
    throw new Error("Datos de meta incompletos");
  }

  return { nombre, precioObjetivo, fechaDeseada: fechaDeseadaRaw || null, metodoPago };
}

export async function crearMetaCompraAction(formData: FormData) {
  await crearMetaCompra(leerCamposMeta(formData));
  revalidatePath("/presupuesto");
  revalidatePath("/");
}

export async function editarMetaCompraAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) throw new Error("Falta el id de la meta");
  await editarMetaCompra(id, leerCamposMeta(formData));
  revalidatePath("/presupuesto");
  revalidatePath("/");
}

export async function actualizarMontoAhorradoAction(id: number, montoAhorrado: number) {
  if (Number.isNaN(montoAhorrado) || montoAhorrado < 0) throw new Error("Monto inválido");
  await actualizarMontoAhorradoMeta(id, montoAhorrado);
  revalidatePath("/presupuesto");
  revalidatePath("/");
}

export async function cambiarEstadoMetaAction(id: number, estado: "activa" | "completada" | "cancelada") {
  await cambiarEstadoMeta(id, estado);
  revalidatePath("/presupuesto");
  revalidatePath("/");
}

export async function eliminarMetaCompraAction(id: number) {
  await eliminarMetaCompra(id);
  revalidatePath("/presupuesto");
  revalidatePath("/configuracion");
  revalidatePath("/");
}
