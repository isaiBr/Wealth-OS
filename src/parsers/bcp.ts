import type { BankParser, ParsedTransaction, RawEmail } from "./types";

const REMITENTE = "notificaciones@notificacionesbcp.com.pe";

const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Acepta ambos formatos de BCP:
 * "12 de setiembre de 2026 - 03:32 PM" (constancias)
 * "Jueves, 03 Septiembre 2026 - 12:46 P. M." (pago de servicios, sin "de")
 */
function parseFecha(texto: string): string | null {
  const m = texto.match(
    /(\d{1,2})\s+(?:de\s+)?([A-Za-zñÑ]+)\s+(?:de\s+)?(\d{4})\s*-\s*(\d{1,2}):(\d{2})\s*([AaPp])[.\s]*[Mm]\.?/
  );
  if (!m) return null;
  const dia = parseInt(m[1], 10);
  const mes = MESES[m[2].toLowerCase()];
  const anio = parseInt(m[3], 10);
  if (!mes) return null;
  let hh = parseInt(m[4], 10);
  const mm = parseInt(m[5], 10);
  const ampm = m[6].toUpperCase();
  if (ampm === "P" && hh !== 12) hh += 12;
  if (ampm === "A" && hh === 12) hh = 0;
  return `${anio}-${pad(mes)}-${pad(dia)}T${pad(hh)}:${pad(mm)}:00`;
}

/** Valor en la misma línea que el label, ej. "Empresa ROMA" -> "ROMA". */
function valorLinea(texto: string, label: string): string | undefined {
  const re = new RegExp(`^${label}\\s+(.+)$`, "im");
  const m = texto.match(re);
  return m?.[1]?.trim();
}

function parseMonto(valor: string | undefined): { monto: number; moneda: string } | null {
  if (!valor) return null;
  const m = valor.match(/(\$|S\/\.?)\s*([\d,]+\.?\d*)/);
  if (!m) return null;
  return {
    monto: parseFloat(m[2].replace(/,/g, "")),
    moneda: m[1].startsWith("$") ? "USD" : "PEN",
  };
}

function parseConsumoDebito(email: RawEmail): ParsedTransaction | null {
  const { body } = email;
  const montoInfo = parseMonto(valorLinea(body, "Total del consumo"));
  const fecha = parseFecha(valorLinea(body, "Fecha y hora") ?? "");
  const comercio = valorLinea(body, "Empresa");
  const numeroOperacion = valorLinea(body, "Número de operación");
  const tarjeta =
    valorLinea(body, "Número de Tarjeta de Débito") ??
    valorLinea(body, "Número de Tarjeta de Crédito") ??
    valorLinea(body, "Número de Tarjeta");

  if (!montoInfo || !fecha) return null;

  return {
    banco: "bcp",
    tipo: "compra",
    monto: montoInfo.monto,
    moneda: montoInfo.moneda,
    comercio,
    fecha,
    numeroOperacion,
    ultimosDigitosTarjeta: tarjeta?.replace(/\D/g, "").slice(-4),
  };
}

function parseDevolucion(email: RawEmail): ParsedTransaction | null {
  const { body } = email;
  const montoInfo = parseMonto(valorLinea(body, "Total devuelto"));
  const fecha = parseFecha(valorLinea(body, "Fecha y hora") ?? "");
  const comercio = valorLinea(body, "Nombre del Comercio");
  const numeroOperacion = valorLinea(body, "Número de operación");
  const tarjeta = valorLinea(body, "Número de Tarjeta");

  if (!montoInfo || !fecha) return null;

  return {
    banco: "bcp",
    tipo: "devolucion",
    monto: montoInfo.monto,
    moneda: montoInfo.moneda,
    comercio,
    fecha,
    numeroOperacion,
    ultimosDigitosTarjeta: tarjeta?.replace(/\D/g, "").slice(-4),
    descripcion: numeroOperacion
      ? `Devuelve la operación ${numeroOperacion} (buscar y anular ese cargo si ya está registrado)`
      : undefined,
  };
}

function parseTransferenciaEntreCuentas(email: RawEmail): ParsedTransaction | null {
  const { body } = email;
  // Si hubo conversión de moneda, "Total cobrado al tipo de cambio" es lo
  // que realmente salió de la cuenta en soles — se prefiere sobre el monto
  // transferido original (que puede venir en USD). Sin eso, no tenemos forma
  // de convertir de forma confiable.
  const montoInfo =
    parseMonto(valorLinea(body, "Total cobrado al tipo de cambio")) ??
    parseMonto(valorLinea(body, "Monto transferido"));
  // La conversión en vivo de HTML a texto (src/gmail/mensaje.ts) a veces deja
  // "Fecha y hora" pegado en la misma línea que el label anterior
  // ("Operación realizada ... Fecha y hora 13 de Septiembre...") en vez de
  // empezar su propia línea como en el correo copiado a mano — por eso, si
  // valorLinea() no la encuentra anclada al inicio de línea, se busca el
  // patrón de fecha en todo el cuerpo como respaldo.
  const fecha = parseFecha(valorLinea(body, "Fecha y hora") ?? body);
  const numeroOperacion = valorLinea(body, "Número de operación");
  const desde = valorLinea(body, "Desde");
  const enviadoA = valorLinea(body, "Enviado a");

  if (!montoInfo || !fecha) return null;

  return {
    banco: "bcp",
    tipo: "transferencia",
    monto: montoInfo.monto,
    moneda: montoInfo.moneda,
    comercio: enviadoA,
    // BCP etiqueta esto explícitamente como transferencia entre cuentas
    // propias — no necesita el motor de matching del roadmap §4.
    descripcion: `Transferencia entre mis cuentas${desde ? ` (desde ${desde})` : ""}`,
    fecha,
    numeroOperacion,
    esTransferenciaInterna: true,
  };
}

function parseTransferenciaOtrosBancos(email: RawEmail): ParsedTransaction | null {
  const { body } = email;
  const montoInfo = parseMonto(valorLinea(body, "Monto enviado"));
  const fecha = parseFecha(valorLinea(body, "Fecha y hora") ?? "");
  const numeroOperacion = valorLinea(body, "Número de operación");
  const enviadoA = valorLinea(body, "Enviado a");
  const bancoDestino = valorLinea(body, "Banco destino");

  if (!montoInfo || !fecha) return null;

  return {
    banco: "bcp",
    tipo: "transferencia",
    monto: montoInfo.monto,
    moneda: montoInfo.moneda,
    comercio: enviadoA,
    descripcion: bancoDestino ? `A ${bancoDestino}` : undefined,
    fecha,
    numeroOperacion,
  };
}

function parseYapeoQR(email: RawEmail): ParsedTransaction | null {
  const { body } = email;
  const montoInfo = parseMonto(valorLinea(body, "Monto enviado"));
  const fecha = parseFecha(valorLinea(body, "Fecha y hora") ?? "");
  const numeroOperacion = valorLinea(body, "Número de operación");
  const enviadoA = valorLinea(body, "Enviado a");
  const destino = valorLinea(body, "Destino");
  const operacionRealizada = valorLinea(body, "Operación realizada");

  if (!montoInfo || !fecha) return null;

  return {
    banco: "bcp",
    tipo: "transferencia",
    monto: montoInfo.monto,
    moneda: montoInfo.moneda,
    comercio: enviadoA,
    descripcion: [operacionRealizada, destino ? `-> ${destino}` : null].filter(Boolean).join(" "),
    fecha,
    numeroOperacion,
  };
}

/**
 * "ENVIO AUTOMATICO - CONSTANCIA DE PAGO DE SERVICIO" — formato distinto
 * (label seguido de dos puntos, no space) al resto de correos de BCP.
 */
function valorConDosPuntos(texto: string, label: string): string | undefined {
  // A veces el valor está en la misma línea ("Empresa: X"), a veces en la
  // siguiente línea tras una línea en blanco ("Número de operación:\n\n123").
  const re = new RegExp(`${label}:\\s*\\n*\\s*(.+)`, "i");
  const m = texto.match(re);
  return m?.[1]?.trim();
}

function parsePagoServicio(email: RawEmail): ParsedTransaction | null {
  const { body } = email;
  const montoInfo = parseMonto(valorConDosPuntos(body, "Monto total"));
  const fecha = parseFecha(valorConDosPuntos(body, "Fecha y hora") ?? "");
  const empresa = valorConDosPuntos(body, "Empresa");
  const servicio = valorConDosPuntos(body, "Servicio");
  const numeroOperacion = valorConDosPuntos(body, "Número de operación");

  if (!montoInfo || !fecha) return null;

  return {
    banco: "bcp",
    tipo: "pago_servicio",
    monto: montoInfo.monto,
    moneda: montoInfo.moneda,
    comercio: empresa,
    descripcion: servicio,
    fecha,
    numeroOperacion,
  };
}

export const bcpParser: BankParser = {
  banco: "bcp",

  puedeParsear(email: RawEmail): boolean {
    return email.from.toLowerCase().includes(REMITENTE);
  },

  parsear(email: RawEmail): ParsedTransaction | null {
    const { body, subject } = email;

    if (/consumo con tu Tarjeta de (Débito|Crédito)/i.test(subject)) return parseConsumoDebito(email);
    if (/devolución de una operación/i.test(subject)) return parseDevolucion(email);
    if (/Transferencia Entre mis Cuentas/i.test(subject)) return parseTransferenciaEntreCuentas(email);
    if (/Transferencia a Otros Bancos/i.test(subject)) return parseTransferenciaOtrosBancos(email);
    if (/Yapeo a Celular/i.test(subject) || /Pago con QR/i.test(subject)) return parseYapeoQR(email);
    if (/PAGO DE SERVICIO/i.test(subject)) return parsePagoServicio(email);

    // "Se rechazó tu compra", "Configuración de Tarjeta", etc. — no son
    // transacciones reales, se descartan deliberadamente (return null).
    if (/^Operación realizada\s+Consumo/im.test(body)) return parseConsumoDebito(email);
    return null;
  },
};
