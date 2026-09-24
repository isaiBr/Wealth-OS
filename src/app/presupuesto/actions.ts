"use server";

import { revalidatePath } from "next/cache";
import {
  editarLimiteCategoria,
  alternarPagoCuotaMes,
  editarCuotasPagadas,
  crearCompraCuotas,
  desglosePorEtiqueta,
  crearMetaCompra,
  editarMetaCompra,
  vincularCompraCuotaAMeta,
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

export async function editarCuotasPagadasAction(compraCuotaId: number, nuevoTotal: number, nuevoComercio?: string) {
  if (Number.isNaN(nuevoTotal) || nuevoTotal < 0) throw new Error("Cantidad de cuotas inválida");
  const comercio = nuevoComercio?.trim();
  if (comercio !== undefined && !comercio) throw new Error("El nombre de la cuota no puede quedar vacío");
  await editarCuotasPagadas(compraCuotaId, nuevoTotal, comercio);
  revalidatePath("/presupuesto");
  revalidatePath("/");
}

export async function crearCompraCuotasAction(formData: FormData) {
  const tarjetaId = Number(formData.get("tarjetaId"));
  const comercio = String(formData.get("comercio") ?? "").trim();
  const montoTotal = parseFloat(String(formData.get("montoTotal") ?? ""));
  const totalCuotas = parseInt(String(formData.get("totalCuotas") ?? ""), 10);
  const fechaCompra = String(formData.get("fechaCompra") ?? "").trim();

  if (!tarjetaId || !comercio || Number.isNaN(montoTotal) || montoTotal <= 0 || !totalCuotas || totalCuotas < 1 || !fechaCompra) {
    throw new Error("Datos de compra en cuotas incompletos");
  }

  await crearCompraCuotas({ tarjetaId, comercio, montoTotal, totalCuotas, fechaCompra });
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

export async function vincularCompraCuotaAMetaAction(id: number, compraCuotaId: number | null) {
  await vincularCompraCuotaAMeta(id, compraCuotaId);
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
