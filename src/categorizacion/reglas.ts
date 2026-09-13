/**
 * Categorización Capa 1 del roadmap §5: reglas por comercio/tipo. Crece con
 * el uso — cuando el usuario confirma una categoría sugerida en Movimientos
 * (o corrige una regla mal aplicada), este es el archivo a extender.
 *
 * Una transacción categorizada aquí nace con categoria_confirmada = true
 * (es una regla directa, no una sugerencia — ver roadmap §8).
 */
const REGLAS_POR_COMERCIO: { patron: RegExp; categoria: string }[] = [
  { patron: /uber/i, categoria: "Transporte" },
  { patron: /plansalud|clinica|essalud|farmacia|botica/i, categoria: "Salud" },
  { patron: /oxxo|tambo|tottus|plaza vea|metro|wong|vivanda|moodshi/i, categoria: "Alimentación" },
  { patron: /netflix|spotify|hbo|disney|youtube premium|icloud|apple\.com\/bill|smart ?fit/i, categoria: "Suscripciones" },
];

/**
 * Los pagos de servicios (agua, luz, internet, cable) llegan por un canal
 * de correo distinto y bien identificado por el banco — no hace falta
 * adivinar por nombre de comercio, el tipo de transacción ya lo dice.
 */
export function categorizarPorTipo(tipo: string): string | null {
  if (tipo === "pago_servicio") return "Servicios";
  return null;
}

export function categorizarPorComercio(comercio: string | null | undefined): string | null {
  if (!comercio) return null;
  for (const regla of REGLAS_POR_COMERCIO) {
    if (regla.patron.test(comercio)) return regla.categoria;
  }
  return null;
}

export function categorizar(tipo: string, comercio: string | null | undefined): string | null {
  return categorizarPorTipo(tipo) ?? categorizarPorComercio(comercio);
}
