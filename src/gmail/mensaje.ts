import type { gmail_v1 } from "googleapis";
import { convert } from "html-to-text";
import type { RawEmail } from "@/parsers/types";

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

function encontrarParte(
  parte: gmail_v1.Schema$MessagePart | undefined,
  mimeType: string
): gmail_v1.Schema$MessagePart | null {
  if (!parte) return null;
  if (parte.mimeType === mimeType && parte.body?.data) return parte;
  for (const hija of parte.parts ?? []) {
    const encontrada = encontrarParte(hija, mimeType);
    if (encontrada) return encontrada;
  }
  return null;
}

function header(payload: gmail_v1.Schema$MessagePart | undefined, nombre: string): string {
  return payload?.headers?.find((h) => h.name?.toLowerCase() === nombre.toLowerCase())?.value ?? "";
}

/**
 * html-to-text representa <b>/<strong> como *texto* (un solo asterisco a
 * cada lado) — eso se mete en medio de los valores que buscan los parsers
 * (ej. "Fecha y hora *12 de Septiembre...*"). Se quita solo el asterisco
 * "suelto" (no precedido/seguido de otro asterisco), así el enmascarado de
 * cuentas/tarjetas ("**** 1051", "*** **5 088") no se toca — ahí todos los
 * asteriscos están pegados entre sí, nunca sueltos.
 */
function quitarNegritaMarkdown(texto: string): string {
  return texto.replace(/(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)/g, "$1");
}

/**
 * Convierte un mensaje de la Gmail API al RawEmail que esperan los parsers.
 * Los parsers se escribieron contra el texto tal como se ve al copiar el
 * correo renderizado en Gmail (ver scripts/data/correos-septiembre.ts) —
 * cuando el correo solo trae HTML (el caso normal de BCP/Interbank), se
 * convierte con html-to-text para aproximar esa misma vista, en vez de
 * pasar el HTML crudo.
 */
export function mensajeARawEmail(message: gmail_v1.Schema$Message): RawEmail | null {
  const payload = message.payload;
  if (!payload) return null;

  const from = header(payload, "From");
  const subject = header(payload, "Subject");

  const partePlano = encontrarParte(payload, "text/plain");
  if (partePlano?.body?.data) {
    return { from, subject, body: decodeBase64Url(partePlano.body.data) };
  }

  const parteHtml = encontrarParte(payload, "text/html");
  if (parteHtml?.body?.data) {
    const html = decodeBase64Url(parteHtml.body.data);
    // format: "dataTable" fuerza una fila de tabla por línea — sin esto,
    // html-to-text junta todas las filas de "Datos de la operación" en una
    // sola línea, y los parsers (que buscan cada label al inicio de línea)
    // no reconocen nada.
    const texto = convert(html, {
      wordwrap: false,
      selectors: [{ selector: "table", format: "dataTable" }],
    });
    return { from, subject, body: quitarNegritaMarkdown(texto) };
  }

  return null;
}
