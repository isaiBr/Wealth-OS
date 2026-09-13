import type { BankParser, ParsedTransaction, RawEmail } from "./types";

const REMITENTE = "servicioalcliente@netinterbank.com.pe";

const MESES: Record<string, number> = {
  ene: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  sep: 9,
  set: 9,
  oct: 10,
  nov: 11,
  dic: 12,
};

// Encabezados de sección conocidos en las "Constancia de ..." de Interbank.
// El texto de estos correos viene de copiar la vista renderizada de Gmail
// (no el HTML/MIME original), así que el layout es "label" en su propia
// línea, seguido de 1+ líneas de valor, hasta el siguiente label conocido.
const LABELS = [
  "código de operación",
  "fecha y hora",
  "cuenta cargo",
  "empresa",
  "destinatario",
  "destino",
  "moneda y monto",
  "monto y moneda",
  "datos",
  "app",
];

function bloque(texto: string, label: string): string[] {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim());
  const idx = lineas.findIndex((l) => l.toLowerCase() === label.toLowerCase());
  if (idx === -1) return [];
  const out: string[] = [];
  for (let i = idx + 1; i < lineas.length; i++) {
    const linea = lineas[i];
    if (linea === "") continue;
    if (LABELS.includes(linea.toLowerCase())) break;
    out.push(linea);
  }
  return out;
}

function parseMonto(texto: string): number | null {
  const m = texto.match(/S\/\.?\s*([\d,]+\.?\d*)/);
  if (!m) return null;
  return parseFloat(m[1].replace(/,/g, ""));
}

/** Interbank usa "Moneda y monto" en unas plantillas y "Monto y moneda" en otras. */
function bloqueMonto(body: string): string[] {
  const a = bloque(body, "Moneda y monto");
  if (a.length > 0) return a;
  return bloque(body, "Monto y moneda");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "12 Jul 2026" [+ opcional "06:02 PM" en la misma u otra línea del bloque] */
function parseFechaBloque(lineasBloque: string[]): string | null {
  const texto = lineasBloque.join(" ");
  const fm = texto.match(/(\d{1,2})\s+([A-Za-zñÑ]{3,})\.?\s+(\d{4})/);
  if (!fm) return null;
  const dia = parseInt(fm[1], 10);
  const mes = MESES[fm[2].toLowerCase().slice(0, 3)];
  const anio = parseInt(fm[3], 10);
  if (!mes) return null;

  let hh = 0;
  let mm = 0;
  const tm = texto.match(/(\d{1,2}):(\d{2})\s*([AaPp])\.?\s*[Mm]\.?/);
  if (tm) {
    hh = parseInt(tm[1], 10);
    mm = parseInt(tm[2], 10);
    const ampm = tm[3].toUpperCase();
    if (ampm === "P" && hh !== 12) hh += 12;
    if (ampm === "A" && hh === 12) hh = 0;
  }
  return `${anio}-${pad(mes)}-${pad(dia)}T${pad(hh)}:${pad(mm)}:00`;
}

/** "12/09/2026" + "04:33 PM" (formato de la notificación de consumo) */
function parseFechaHoraInline(body: string): string | null {
  const fm = body.match(/Fecha:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  if (!fm) return null;
  const dia = parseInt(fm[1], 10);
  const mes = parseInt(fm[2], 10);
  const anio = parseInt(fm[3], 10);

  let hh = 0;
  let mm = 0;
  const tm = body.match(/Hora:\s*(\d{1,2}):(\d{2})\s*([AaPp])\.?\s*[Mm]\.?/);
  if (tm) {
    hh = parseInt(tm[1], 10);
    mm = parseInt(tm[2], 10);
    const ampm = tm[3].toUpperCase();
    if (ampm === "P" && hh !== 12) hh += 12;
    if (ampm === "A" && hh === 12) hh = 0;
  }
  return `${anio}-${pad(mes)}-${pad(dia)}T${pad(hh)}:${pad(mm)}:00`;
}

function parseConsumoTarjeta(email: RawEmail): ParsedTransaction | null {
  const { body } = email;
  const montoStr = body.match(/Monto:\s*(S\/\.?\s*[\d,]+\.?\d*)/i)?.[1];
  const monto = montoStr ? parseMonto(montoStr) : null;
  const comercio = body.match(/Comercio:\s*(.+)/i)?.[1]?.trim();
  const tarjeta = body.match(/Tarjeta:\s*(\**\d+)/i)?.[1];
  const fecha = parseFechaHoraInline(body);

  if (monto === null || !fecha) return null;

  return {
    banco: "interbank",
    tipo: "compra",
    monto,
    moneda: "PEN",
    comercio,
    fecha,
    ultimosDigitosTarjeta: tarjeta?.replace(/\D/g, ""),
    // Este tipo de correo no trae código de operación — dedupe por
    // composite hasta que la ingesta real use el message-id de Gmail.
    claveDedupAlterna: `${tarjeta ?? ""}|${monto}|${fecha}`,
  };
}

function parsePagoServicio(email: RawEmail): ParsedTransaction | null {
  const { body } = email;
  const codigoOperacion = bloque(body, "Código de operación")[0];
  const fecha = parseFechaBloque(bloque(body, "Fecha y hora"));
  const cuentaCargo = bloque(body, "Cuenta cargo").join(" ");
  const empresaBloque = bloque(body, "Empresa");
  const montoLineas = bloqueMonto(body).join(" ");
  const monto = parseMonto(montoLineas);

  if (monto === null || !fecha) return null;

  return {
    banco: "interbank",
    tipo: "pago_servicio",
    monto,
    moneda: "PEN",
    comercio: empresaBloque[0],
    descripcion: empresaBloque.slice(1).join(" ") || undefined,
    fecha,
    numeroOperacion: codigoOperacion,
    cuentaOrigenLabel: cuentaCargo || undefined,
  };
}

function parsePagoPlin(email: RawEmail): ParsedTransaction | null {
  const { body } = email;
  const codigoOperacion = bloque(body, "Código de operación")[0];
  const fecha = parseFechaBloque(bloque(body, "Fecha y hora"));
  const cuentaCargo = bloque(body, "Cuenta cargo").join(" ");
  const destinatario = bloque(body, "Destinatario").join(" ");
  const destino = bloque(body, "Destino").join(" ");
  const montoLineas = bloqueMonto(body).join(" ");
  const monto = parseMonto(montoLineas);

  if (monto === null || !fecha) return null;

  return {
    banco: "interbank",
    tipo: "transferencia",
    monto,
    moneda: "PEN",
    comercio: destinatario || undefined,
    descripcion: destino ? `Plin -> ${destino}` : "Plin",
    fecha,
    numeroOperacion: codigoOperacion,
    cuentaOrigenLabel: cuentaCargo || undefined,
  };
}

/**
 * Un mismo archivo/hilo puede traer más de un correo pegado uno tras otro
 * (pasa cuando se copian varios mensajes de un mismo hilo de Gmail). Se
 * separa por la línea del remitente, que se repite al inicio de cada correo.
 */
function separarCorreos(body: string): string[] {
  const marcador = /Interbank Servicio al Cliente|Servicio al cliente/i;
  const lineas = body.split(/\r?\n/);
  const indices: number[] = [];
  lineas.forEach((l, i) => {
    if (marcador.test(l)) indices.push(i);
  });
  if (indices.length <= 1) return [body];
  const partes: string[] = [];
  for (let i = 0; i < indices.length; i++) {
    const inicio = indices[i];
    const fin = i + 1 < indices.length ? indices[i + 1] : lineas.length;
    partes.push(lineas.slice(inicio, fin).join("\n"));
  }
  return partes;
}

export const interbankParser: BankParser & {
  parsearTodos(email: RawEmail): ParsedTransaction[];
} = {
  banco: "interbank",

  puedeParsear(email: RawEmail): boolean {
    return email.from.toLowerCase().includes(REMITENTE);
  },

  parsear(email: RawEmail): ParsedTransaction | null {
    return this.parsearTodos(email)[0] ?? null;
  },

  parsearTodos(email: RawEmail): ParsedTransaction[] {
    const partes = separarCorreos(email.body);
    const resultados: ParsedTransaction[] = [];

    for (const parte of partes) {
      const sub = email.subject;
      const parteEmail: RawEmail = { ...email, body: parte };
      let resultado: ParsedTransaction | null = null;

      if (/realizaste un consumo con tu Tarjeta/i.test(parte) || /realizaste un consumo/i.test(sub)) {
        resultado = parseConsumoTarjeta(parteEmail);
      } else if (/Constancia de Pago Plin/i.test(parte)) {
        resultado = parsePagoPlin(parteEmail);
      } else if (/Constancia de pago/i.test(parte)) {
        resultado = parsePagoServicio(parteEmail);
      }

      if (resultado) resultados.push(resultado);
    }

    return resultados;
  },
};
