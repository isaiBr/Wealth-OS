import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { briefConfiguracion, briefTemas } from "@/db/schema";

export type BriefTema = typeof briefTemas.$inferSelect;

export async function listarTemas() {
  return db.select().from(briefTemas).orderBy(asc(briefTemas.orden), asc(briefTemas.id));
}

function claveDesdeNombre(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function crearTema(input: { nombre: string; query: string; cantidad: number }): Promise<void> {
  const clave = claveDesdeNombre(input.nombre) || `tema_${Date.now()}`;
  const [{ max } = { max: -1 }] = await db
    .select({ max: briefTemas.orden })
    .from(briefTemas)
    .orderBy(desc(briefTemas.orden))
    .limit(1);
  await db.insert(briefTemas).values({ ...input, clave, orden: (max ?? -1) + 1 });
}

export async function editarTema(
  id: number,
  input: { nombre: string; query: string; cantidad: number }
): Promise<void> {
  await db.update(briefTemas).set(input).where(eq(briefTemas.id, id));
}

export async function alternarActivoTema(id: number, activo: boolean): Promise<void> {
  await db.update(briefTemas).set({ activo }).where(eq(briefTemas.id, id));
}

export async function eliminarTema(id: number): Promise<void> {
  await db.delete(briefTemas).where(eq(briefTemas.id, id));
}

/** Sin fila todavía = resumen con IA prendido (comportamiento actual). */
export async function obtenerConfiguracionBrief(): Promise<{ resumenConIa: boolean }> {
  const fila = await db.select().from(briefConfiguracion).orderBy(desc(briefConfiguracion.id)).limit(1).get();
  if (!fila) return { resumenConIa: true };
  return { resumenConIa: fila.resumenConIa };
}

export async function actualizarConfiguracionBrief(input: { resumenConIa: boolean }): Promise<void> {
  const existente = await db.select().from(briefConfiguracion).orderBy(desc(briefConfiguracion.id)).limit(1).get();
  if (existente) {
    await db.update(briefConfiguracion).set(input).where(eq(briefConfiguracion.id, existente.id));
  } else {
    await db.insert(briefConfiguracion).values(input);
  }
}
