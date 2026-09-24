import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { categorias, cuentas, tarjetas, transacciones } from "@/db/schema";
import { bcpParser } from "@/parsers/bcp";
import { interbankParser } from "@/parsers/interbank";
import { yapeParser } from "@/parsers/yape";
import type { ParsedTransaction, RawEmail } from "@/parsers/types";
import { pareceNombrePropio } from "@/logic/transferencia-interna";
import { categorizarPorTipo, categorizarPorComercio } from "@/categorizacion/reglas";
import { categorizarConIA } from "@/categorizacion/ia";
import { buscarReglaPorComercio, obtenerConfiguracionIA } from "@/db/queries";
import { TIPO_CAMBIO_USD_PEN } from "@/config/moneda";
import {
  extraerDigitosDestino,
  extraerDigitosOrigen,
  resolverCuentaIdPorBilletera,
  resolverCuentaIdPorDigitos,
} from "@/gmail/resolver-cuenta";

export type ResultadoIngesta =
  | { estado: "insertada"; transaccionId: number }
  | { estado: "omitida"; razon: string }
  | { estado: "duplicada" };

const PALABRAS_TARJETA = ["tarjeta", "credito", "crédito", "visa", "mastercard", "amex"];

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Ningún banco marca de forma consistente el pago de una tarjeta de crédito
 * como "transferencia entre cuentas" — sobre todo si es a la tarjeta de OTRO
 * banco, suele llegar como un "pago de servicio" más, con el banco/tarjeta
 * como "empresa". Sin esto: se cuenta como gasto real (inflando el mes) y no
 * se actualiza la deuda de la tarjeta (saldoCuenta necesita cuentaDestinoId).
 * Se detecta por nombre en vez de por parser/banco específico porque aplica
 * igual sin importar qué correo lo trajo.
 */
async function detectarCuentaTarjetaPropia(comercio: string | null | undefined): Promise<number | null> {
  if (!comercio) return null;
  const comercioNorm = normalizar(comercio);

  const tarjetasCredito = await db.select().from(cuentas).where(eq(cuentas.tipo, "tarjeta_credito"));
  if (tarjetasCredito.length === 0) return null;

  const tarjetasFisicas = await db
    .select()
    .from(tarjetas)
    .where(inArray(tarjetas.cuentaId, tarjetasCredito.map((c) => c.id)));

  // 1) El comercio menciona el nombre exacto de una tarjeta propia
  //    (ej. "Interbank Visa Signature").
  for (const t of tarjetasFisicas) {
    if (t.cuentaId && comercioNorm.includes(normalizar(t.nombre))) return t.cuentaId;
  }

  // 2) Menciona el banco Y una palabra de tarjeta/crédito a la vez
  //    (ej. "Pago Tarjeta BCP", "Tarjeta de Credito Interbank").
  for (const c of tarjetasCredito) {
    const mencionaBanco = comercioNorm.includes(normalizar(c.banco));
    const mencionaTarjeta = PALABRAS_TARJETA.some((p) => comercioNorm.includes(p));
    if (mencionaBanco && mencionaTarjeta) return c.id;
  }

  return null;
}

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
  else if (yapeParser.puedeParsear(email)) parsed = yapeParser.parsear(email);
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
  if (parsed.billeteraOrigen) {
    cuentaId = await resolverCuentaIdPorBilletera(parsed.billeteraOrigen);
  } else if (parsed.banco === "interbank") {
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

  // Ningún banco marca de forma consistente el pago de tu propia tarjeta de
  // crédito — se detecta por nombre además del flag explícito del parser.
  const cuentaTarjetaPropia =
    parsed.tipo === "compra" || parsed.tipo === "ingreso" || parsed.tipo === "devolucion"
      ? null
      : await detectarCuentaTarjetaPropia(parsed.comercio);
  // Si coincide con la propia cuenta de origen (nombre ambiguo), no cuenta:
  // origen y destino no pueden ser la misma cuenta.
  const tipoFinal: ParsedTransaction["tipo"] =
    cuentaTarjetaPropia !== null && cuentaTarjetaPropia !== cuentaId ? "pago_tarjeta_credito" : parsed.tipo;
  const esTransferenciaInterna =
    parsed.esTransferenciaInterna || pareceNombrePropio(parsed.comercio) || tipoFinal === "pago_tarjeta_credito";
  const categoriaIdPorNombre = await obtenerCategoriaIdPorNombre();
  const { sugerirConIa } = await obtenerConfiguracionIA();

  let categoriaId: number | null = null;
  let categoriaConfirmada = false;
  if (!esTransferenciaInterna && parsed.tipo !== "devolucion") {
    // Paso 1: Categorización por tipo (pagos de servicios)
    const nombrePorTipo = categorizarPorTipo(tipoFinal);
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
  // Sin dígitos que resolver (o no vinieron), pero sí se detectó por nombre
  // que es el pago de una tarjeta propia — usa esa cuenta como destino para
  // que saldoCuenta() de la tarjeta refleje el pago.
  if (cuentaDestinoId === null && cuentaTarjetaPropia !== null && cuentaTarjetaPropia !== cuentaId) {
    cuentaDestinoId = cuentaTarjetaPropia;
  }

  const [insertada] = await db
    .insert(transacciones)
    .values({
      cuentaId,
      tipo: tipoFinal,
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
