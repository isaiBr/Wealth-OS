import type { BankParser, ParsedTransaction, RawEmail } from "./types";
import { parseFecha, parseMonto } from "./bcp";

const REMITENTE = "yape.pe";

/**
 * Confirmación de un yapeo que TÚ mandaste, enviada por Yape mismo (no por
 * BCP) — mismo evento que BCP ya notifica por su cuenta con "Yapeo a
 * Celular"/"Pago con QR" (parseYapeoQR en bcp.ts). Se parsea igual como
 * `transferencia` con el mismo número de operación para que el índice único
 * (numeroOperacion, tipo) de la tabla dedupe solo si ambos correos traen el
 * mismo número — si no coinciden, sirve de respaldo cuando el correo de BCP
 * no llega (ver conversación 2026-09-20).
 *
 * El texto de este correo no viene en tabla (a diferencia de los de BCP) —
 * todo el detalle de la operación queda en un solo párrafo largo separado
 * por espacios, no por líneas, y con asteriscos sueltos de negrita que
 * `quitarNegritaMarkdown` no siempre limpia (el nombre parcialmente
 * enmascarado del banco deja asteriscos pegados). Por eso acá se usa
 * [\s\S]*? entre labels en vez del helper valorLinea() de bcp.ts (que
 * asume un valor por línea).
 */
function parseYapeoEnviado(email: RawEmail): ParsedTransaction | null {
  const { body } = email;
  if (!/Acabas de yapear exitosamente/i.test(body)) return null;

  const montoMatch = body.match(/Monto de yapeo[\s*]{0,10}[\s\S]{0,20}?(S\/\.?\s*[\d,]+\.?\d*)/i);
  const montoInfo = parseMonto(montoMatch?.[1]);

  const fechaMatch = body.match(
    /Fecha y Hora de la operaci[oó]n\s+([\s\S]*?)(?:\s*Celular del Beneficiario|\s*Nombre del Beneficiario|$)/i
  );
  const fecha = parseFecha(fechaMatch?.[1] ?? "");

  const beneficiarioMatch = body.match(
    /Nombre del Beneficiario\s+([\s\S]*?)(?:\s*N[°º]\s*de\s*operaci[oó]n|$)/i
  );
  const beneficiario = beneficiarioMatch?.[1]?.replace(/\*/g, "").trim() || undefined;

  const numeroOperacion = body.match(/N[°º]\s*de\s*operaci[oó]n\s+(\d+)/i)?.[1];

  if (!montoInfo || !fecha) return null;

  return {
    banco: "yape",
    tipo: "transferencia",
    monto: montoInfo.monto,
    moneda: montoInfo.moneda,
    comercio: beneficiario,
    descripcion: beneficiario ? `Yapeo enviado a ${beneficiario} (notificado por Yape)` : "Yapeo enviado (notificado por Yape)",
    fecha,
    numeroOperacion,
    billeteraOrigen: "yape",
  };
}

export const yapeParser: BankParser = {
  banco: "yape",

  puedeParsear(email: RawEmail): boolean {
    return email.from.toLowerCase().includes(REMITENTE);
  },

  parsear(email: RawEmail): ParsedTransaction | null {
    // Yape manda varios tipos de correo que no son transacciones (cambios de
    // configuración, "pago exitoso" en comercios vía QR que puede solaparse
    // con lo que BCP ya notifica distinto) — de momento solo se reconoce la
    // confirmación de yapeo enviado; el resto se descarta deliberadamente
    // (return null) hasta confirmar con más ejemplos reales cómo se cruzan
    // con las notificaciones de BCP.
    return parseYapeoEnviado(email);
  },
};
