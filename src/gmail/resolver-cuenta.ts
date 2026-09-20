import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cuentas, identificadoresCuenta } from "@/db/schema";

// Movidas acá desde scripts/rebuild-cuentas-bcp.ts para que el webhook en
// vivo use la misma extracción de dígitos que el script de carga a mano.
// El "\s*" antes de "\*+" tolera los espacios de alineación que deja la
// conversión HTML->texto de las tablas (dataTable) del correo en vivo — el
// texto copiado a mano de correos-septiembre.ts no los trae, pero \s*
// también matchea cero espacios, así que ambos formatos siguen funcionando.
export function extraerDigitosOrigen(body: string): string | null {
  const m =
    body.match(/Desde\s+[^\n]+\n\s*\*+\s*(\d{4})/i) ??
    body.match(/Cuenta de origen:?\s*[^\n]+\n\s*\*+\s*(\d{4})/i);
  return m?.[1] ?? null;
}

export function extraerDigitosDestino(body: string): string | null {
  const m = body.match(/Enviado a\s+[^\n]+\n\s*\*+\s*(\d{4})/i);
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

/**
 * Yape no expone dígitos de cuenta en sus correos (ni en los que manda BCP
 * ni en los que manda yape.pe directamente) — solo el celular. Se resuelve
 * por la cuenta marcada con esa billetera en `cuentas.billetera`.
 */
export async function resolverCuentaIdPorBilletera(billetera: "yape" | "plin"): Promise<number | null> {
  const fila = await db.select().from(cuentas).where(eq(cuentas.billetera, billetera)).get();
  return fila?.id ?? null;
}
