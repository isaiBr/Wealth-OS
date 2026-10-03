import { and, asc, desc, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db/client";
import { briefConfiguracion, briefTemas } from "@/db/schema";

// Una corrida real tarda segundos (RSS + 2 llamados a Haiku), así que si el
// lock lleva más que esto se asume colgada (ej. el server se cayó a mitad de
// una corrida) y se deja tomar de nuevo.
const LOCK_TIMEOUT_MS = 3 * 60 * 1000;

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
export async function obtenerConfiguracionBrief(): Promise<{ resumenConIa: boolean; generando: boolean }> {
  const fila = await db.select().from(briefConfiguracion).orderBy(desc(briefConfiguracion.id)).limit(1).get();
  if (!fila) return { resumenConIa: true, generando: false };
  const generando = !!fila.generandoDesde && Date.now() - fila.generandoDesde.getTime() < LOCK_TIMEOUT_MS;
  return { resumenConIa: fila.resumenConIa, generando };
}

export async function actualizarConfiguracionBrief(input: { resumenConIa: boolean }): Promise<void> {
  const existente = await db.select().from(briefConfiguracion).orderBy(desc(briefConfiguracion.id)).limit(1).get();
  if (existente) {
    await db.update(briefConfiguracion).set(input).where(eq(briefConfiguracion.id, existente.id));
  } else {
    await db.insert(briefConfiguracion).values(input);
  }
}

/**
 * Toma el lock de generación (compare-and-swap vía WHERE) — devuelve false si
 * ya hay una corrida en curso y no está colgada. Usado por el cron y por el
 * botón "Generar ahora" para no pisarse ni duplicar el gasto de IA.
 */
export async function intentarIniciarGeneracionBrief(): Promise<boolean> {
  const ahora = new Date();
  const limite = new Date(ahora.getTime() - LOCK_TIMEOUT_MS);
  const existente = await db.select().from(briefConfiguracion).orderBy(desc(briefConfiguracion.id)).limit(1).get();

  if (!existente) {
    await db.insert(briefConfiguracion).values({ generandoDesde: ahora });
    return true;
  }

  const resultado = await db
    .update(briefConfiguracion)
    .set({ generandoDesde: ahora })
    .where(
      and(
        eq(briefConfiguracion.id, existente.id),
        or(isNull(briefConfiguracion.generandoDesde), lt(briefConfiguracion.generandoDesde, limite))
      )
    );
  return resultado.rowsAffected > 0;
}

/** Libera el lock — llamar siempre en un `finally`, corrida exitosa o no. */
export async function finalizarGeneracionBrief(): Promise<void> {
  const existente = await db.select().from(briefConfiguracion).orderBy(desc(briefConfiguracion.id)).limit(1).get();
  if (existente) {
    await db.update(briefConfiguracion).set({ generandoDesde: null }).where(eq(briefConfiguracion.id, existente.id));
  }
}
