"use server";

import { revalidatePath } from "next/cache";
import {
  crearTema,
  editarTema,
  alternarActivoTema,
  eliminarTema,
  actualizarConfiguracionBrief,
} from "@/lib/brief/queries";
import { generarYGuardarBrief } from "@/lib/brief/generate-brief";
import { todayInLima } from "@/lib/brief/dates";

export async function crearTemaAction(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const query = String(formData.get("query") ?? "").trim();
  const cantidad = parseInt(String(formData.get("cantidad") ?? "3"), 10);

  if (!nombre || !query || Number.isNaN(cantidad) || cantidad < 1) {
    throw new Error("Datos de tema incompletos");
  }

  await crearTema({ nombre, query, cantidad });
  revalidatePath("/brief/config");
}

export async function editarTemaAction(formData: FormData) {
  const id = parseInt(String(formData.get("id") ?? ""), 10);
  const nombre = String(formData.get("nombre") ?? "").trim();
  const query = String(formData.get("query") ?? "").trim();
  const cantidad = parseInt(String(formData.get("cantidad") ?? "3"), 10);

  if (!id || !nombre || !query || Number.isNaN(cantidad) || cantidad < 1) {
    throw new Error("Datos de tema incompletos");
  }

  await editarTema(id, { nombre, query, cantidad });
  revalidatePath("/brief/config");
}

export async function alternarActivoTemaAction(id: number, activo: boolean) {
  await alternarActivoTema(id, activo);
  revalidatePath("/brief/config");
}

export async function eliminarTemaAction(id: number) {
  await eliminarTema(id);
  revalidatePath("/brief/config");
}

export async function actualizarResumenConIaAction(resumenConIa: boolean) {
  await actualizarConfiguracionBrief({ resumenConIa });
  revalidatePath("/brief/config");
}

/**
 * Botón "Generar ahora" — nunca fuerza (no borra un brief ya generado hoy),
 * así clickearlo dos veces el mismo día no gasta de más. Para forzar habría
 * que ir directo al endpoint del cron con `?force=true`.
 */
export async function generarBriefAhoraAction(): Promise<{ status: "ok" | "skipped"; date: string }> {
  const date = todayInLima();
  const resultado = await generarYGuardarBrief(date, false);
  revalidatePath("/brief");
  revalidatePath("/brief/historial");
  return { ...resultado, date };
}
