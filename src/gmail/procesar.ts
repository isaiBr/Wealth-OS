import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { categorias, cuentas, transacciones } from "@/db/schema";
import { bcpParser } from "@/parsers/bcp";
import { interbankParser } from "@/parsers/interbank";
import type { RawEmail } from "@/parsers/types";
import { pareceNombrePropio } from "@/logic/transferencia-interna";
import { categorizar } from "@/categorizacion/reglas";
import { categorizarConIA } from "@/categorizacion/ia";
import { TIPO_CAMBIO_USD_PEN } from "@/config/moneda";
import { extraerDigitosDestino, extraerDigitosOrigen, resolverCuentaIdPorDigitos } from "@/gmail/resolver-cuenta";

export type ResultadoIngesta =
  | { estado: "insertada"; transaccionId: number }
  | { estado: "omitida"; razon: string }
  | { estado: "duplicada" };

let categoriaIdPorNombreCache: Map<string, number> | null = null;
async function obtenerCategoriaIdPorNombre(): Promise<Map<string, number>> {
  if (!categoriaIdPorNombreCache) {
    const todas = await db.select().from(categorias);
    categoriaIdPorNombreCache = new Map(todas.map((c) => [c.nombre, c.id]));
  }
  return categoriaIdPorNombreCache;
}

/**
 * Procesa un correo ya extraído de Gmail: lo parsea, resuelve la cuenta,
 * categoriza, y lo inserta — la versión "en vivo" de lo que
 * scripts/rebuild-cuentas-bcp.ts hace en lote desde un array fijo de
 * correos históricos.
 */
export async function procesarCorreo(email: RawEmail, gmailMessageId?: string): Promise<ResultadoIngesta> {
  let parsed = null;
  if (bcpParser.puedeParsear(email)) parsed = bcpParser.parsear(email);
  else if (interbankParser.puedeParsear(email)) parsed = interbankParser.parsear(email);
  if (!parsed) return { estado: "omitida", razon: "remitente/formato no reconocido" };

  let monto = parsed.monto;
  let descripcion = parsed.descripcion;
  if (parsed.moneda !== "PEN") {
    const montoOriginal = monto;
    monto = Math.round(monto * TIPO_CAMBIO_USD_PEN * 100) / 100;
    descripcion = [descripcion, `$${montoOriginal.toFixed(2)} USD @ ${TIPO_CAMBIO_USD_PEN}`]
      .filter(Boolean)
      .join(" — ");
  }

  let cuentaId: number | null;
  if (parsed.banco === "interbank") {
    // Fase 0-1 solo trackea una cuenta Interbank — si en el futuro hay más
    // de una, esto necesita su propia entrada en identificadores_cuenta.
    const fila = await db.select().from(cuentas).where(eq(cuentas.banco, "interbank")).get();
    cuentaId = fila?.id ?? null;
  } else {
    cuentaId =
      (await resolverCuentaIdPorDigitos(parsed.ultimosDigitosTarjeta)) ??
      (await resolverCuentaIdPorDigitos(extraerDigitosOrigen(email.body)));
  }

  if (cuentaId === null) {
    return {
      estado: "omitida",
      razon: `no se pudo resolver la cuenta (tarjeta ${parsed.ultimosDigitosTarjeta ?? "?"})`,
    };
  }

  const esTransferenciaInterna = parsed.esTransferenciaInterna || pareceNombrePropio(parsed.comercio);
  const categoriaIdPorNombre = await obtenerCategoriaIdPorNombre();

  let nombreCategoria: string | null = null;
  let categoriaConfirmada = false;
  if (!esTransferenciaInterna && parsed.tipo !== "devolucion") {
    nombreCategoria = categorizar(parsed.tipo, parsed.comercio);
    if (nombreCategoria !== null) {
      categoriaConfirmada = true; // Capa 1: regla directa por comercio/tipo
    } else {
      // Capa 2 (roadmap §5): ninguna regla matcheó, se le pasa a Claude.
      // Nace como sugerencia, no confirmada (roadmap §8) — el usuario la
      // confirma o corrige desde Movimientos.
      nombreCategoria = await categorizarConIA(
        { tipo: parsed.tipo, comercio: parsed.comercio, descripcion, monto },
        [...categoriaIdPorNombre.keys()]
      );
      categoriaConfirmada = false;
    }
  }
  const categoriaId = nombreCategoria ? categoriaIdPorNombre.get(nombreCategoria) ?? null : null;

  let cuentaDestinoId: number | null = null;
  if (parsed.esTransferenciaInterna && parsed.banco === "bcp") {
    cuentaDestinoId = await resolverCuentaIdPorDigitos(extraerDigitosDestino(email.body));
  }

  const [insertada] = await db
    .insert(transacciones)
    .values({
      cuentaId,
      tipo: parsed.tipo,
      monto,
      moneda: "PEN",
      comercio: parsed.comercio,
      descripcion,
      fecha: parsed.fecha,
      numeroOperacion: parsed.numeroOperacion,
      categoriaId,
      categoriaConfirmada: categoriaId !== null && categoriaConfirmada,
      esTransferenciaInterna,
      cuentaDestinoId,
      fuente: "email",
      correoRaw: email.body,
      gmailMessageId: gmailMessageId ?? null,
    })
    .onConflictDoNothing()
    .returning();

  if (!insertada) return { estado: "duplicada" };
  return { estado: "insertada", transaccionId: insertada.id };
}
