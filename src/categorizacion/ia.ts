import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * Categorización Capa 2 del roadmap §5: fallback con Claude cuando ninguna
 * regla de comercio (Capa 1, ver reglas.ts) matchea. Haiku 4.5 porque es
 * clasificación de texto corto — el costo estimado en plan-tecnico-mvp.md
 * (§4.1) es de centavos de dólar al mes incluso en el escenario pesimista.
 *
 * A diferencia de Capa 1, esto nace como SUGERENCIA (categoria_confirmada
 * = false, ver roadmap §8) — no se auto-confirma sin que el usuario la vea.
 */
const MODELO = "claude-haiku-4-5";

let clienteCache: Anthropic | null = null;
function obtenerCliente(): Anthropic {
  if (!clienteCache) clienteCache = new Anthropic();
  return clienteCache;
}

export interface DatosTransaccion {
  tipo: string;
  comercio: string | null | undefined;
  descripcion: string | null | undefined;
  monto: number;
}

/**
 * Devuelve el nombre de la categoría elegida por Claude, o null si la
 * llamada falla — un fallo de IA nunca debe tumbar el procesamiento del
 * correo (la transacción se guarda sin categoría, igual que antes de
 * tener Capa 2).
 */
export async function categorizarConIA(
  datos: DatosTransaccion,
  categoriasDisponibles: string[]
): Promise<string | null> {
  if (categoriasDisponibles.length === 0) return null;

  const Salida = z.object({
    categoria: z.enum(categoriasDisponibles as [string, ...string[]]),
  });

  try {
    const respuesta = await obtenerCliente().messages.parse({
      model: MODELO,
      max_tokens: 256,
      system:
        "Clasificas una transacción bancaria peruana en UNA sola categoría de la lista dada. " +
        "Responde con la categoría más probable aunque no estés 100% seguro. Usa 'Otros' solo si de verdad no calza en ninguna otra.",
      messages: [
        {
          role: "user",
          content: [
            `Tipo: ${datos.tipo}`,
            `Comercio/destinatario: ${datos.comercio ?? "(sin dato)"}`,
            `Descripción: ${datos.descripcion ?? "(sin dato)"}`,
            `Monto: S/ ${datos.monto.toFixed(2)}`,
            "",
            `Categorías disponibles: ${categoriasDisponibles.join(", ")}`,
          ].join("\n"),
        },
      ],
      output_config: { format: zodOutputFormat(Salida) },
    });

    return respuesta.parsed_output?.categoria ?? null;
  } catch (error) {
    console.error("categorizacion IA: fallo la llamada a Claude", error);
    return null;
  }
}
