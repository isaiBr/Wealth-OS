import { NOMBRE_TITULAR } from "@/config/usuario";

const PARTES_NOMBRE = NOMBRE_TITULAR.toLowerCase().split(/\s+/);

/**
 * Heurística simple del roadmap §4/§9: si el comercio/destinatario de una
 * compra o transferencia es el propio titular de la cuenta (ej. pagos a tu
 * propio Yape/Plin, o transferencias a otro banco a tu propio nombre),
 * es un candidato fuerte a transferencia interna aunque el banco no lo
 * etiquete explícitamente como tal.
 *
 * Exige al menos 2 coincidencias de las partes del nombre para evitar falsos
 * positivos con terceros que comparten un nombre o apellido.
 */
export function pareceNombrePropio(texto: string | null | undefined): boolean {
  if (!texto) return false;
  const normalizado = texto.toLowerCase();
  const coincidencias = PARTES_NOMBRE.filter((parte) => normalizado.includes(parte)).length;
  return coincidencias >= 2;
}
