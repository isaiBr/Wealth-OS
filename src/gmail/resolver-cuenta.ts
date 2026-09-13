import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { identificadoresCuenta } from "@/db/schema";

// Movidas acá desde scripts/rebuild-cuentas-bcp.ts para que el webhook en
// vivo use la misma extracción de dígitos que el script de carga a mano.
export function extraerDigitosOrigen(body: string): string | null {
  const m =
    body.match(/Desde\s+[^\n]+\n\*+\s*(\d{4})/i) ??
    body.match(/Cuenta de origen:?\s*[^\n]+\n\*+\s*(\d{4})/i);
  return m?.[1] ?? null;
}

export function extraerDigitosDestino(body: string): string | null {
  const m = body.match(/Enviado a\s+[^\n]+\n\*+\s*(\d{4})/i);
  return m?.[1] ?? null;
}

/** Resuelve "estos 4 dígitos" -> cuenta real, vía la tabla identificadores_cuenta. */
export async function resolverCuentaIdPorDigitos(digitos: string | null | undefined): Promise<number | null> {
  if (!digitos) return null;
  const fila = await db
    .select()
    .from(identificadoresCuenta)
    .where(eq(identificadoresCuenta.ultimosDigitos, digitos))
    .get();
  return fila?.cuentaId ?? null;
}
