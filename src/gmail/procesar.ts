import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { categorias, cuentas, transacciones } from "@/db/schema";
import { bcpParser } from "@/parsers/bcp";
import { interbankParser } from "@/parsers/interbank";
import type { RawEmail } from "@/parsers/types";
import { pareceNombrePropio } from "@/logic/transferencia-interna";
import { categorizarPorTipo, categorizarPorComercio } from "@/categorizacion/reglas";
import { categorizarConIA } from "@/categorizacion/ia";
import { buscarReglaPorComercio, obtenerConfiguracionIA } from "@/db/queries";
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
  const { sugerirConIa } = await obtenerConfiguracionIA();

  let categoriaId: number | null = null;
  let categoriaConfirmada = false;
  if (!esTransferenciaInterna && parsed.tipo !== "devolucion") {
    // Paso 1: Categorización por tipo (pagos de servicios)
    const nombrePorTipo = categorizarPorTipo(parsed.tipo);
    if (nombrePorTipo !== null) {
      categoriaId = categoriaIdPorNombre.get(nombrePorTipo) ?? null;
      categoriaConfirmada = true;
    } else if (parsed.comercio) {
      // Paso 2: Búsqueda en reglas de la BD (aprendidas)
      const categoriaIdBD = await buscarReglaPorComercio(parsed.comercio);
      if (categoriaIdBD !== null) {
        categoriaId = categoriaIdBD;
        categoriaConfirmada = true;
      } else {
        // Paso 3: Array hardcodeado de reglas por comercio
        const nombrePorComercio = categorizarPorComercio(parsed.comercio);
        if (nombrePorComercio !== null) {
          categoriaId = categoriaIdPorNombre.get(nombrePorComercio) ?? null;
          categoriaConfirmada = true;
        } else {
          // Paso 4: Capa 2 (roadmap §5) — categorización con IA, si está
          // prendida en Configuración. Nace como sugerencia, no confirmada
          // (roadmap §8) — el usuario la confirma o corrige desde Movimientos.
          const nombrePorIA = sugerirConIa
            ? await categorizarConIA(
                { tipo: parsed.tipo, comercio: parsed.comercio, descripcion, monto },
                [...categoriaIdPorNombre.keys()]
              )
            : null;
          if (nombrePorIA) {
            categoriaId = categoriaIdPorNombre.get(nombrePorIA) ?? null;
          }
          categoriaConfirmada = false;
        }
      }
    } else if (sugerirConIa) {
      // Sin comercio y no es pago_servicio — intenta con IA
      const nombrePorIA = await categorizarConIA(
        { tipo: parsed.tipo, comercio: parsed.comercio ?? "", descripcion, monto },
        [...categoriaIdPorNombre.keys()]
      );
      if (nombrePorIA) {
        categoriaId = categoriaIdPorNombre.get(nombrePorIA) ?? null;
      }
      categoriaConfirmada = false;
    }
  }

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
