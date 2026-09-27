import { z } from "zod";

const storyItem = z.object({
  title: z.string(),
  summary: z.string(),
  why_it_matters: z.string(),
  context: z.string(),
  what_could_change: z.string(),
  facts_vs_interpretation: z.string(),
  source: z.string(),
  source_url: z.string(),
});

// Formato liviano para las categorías (§2.11 del plan) — a diferencia de
// top5, no lleva el análisis completo Hecho/Interpretación/Predicción, solo
// el enlace y una razón corta. `why` queda vacío cuando el brief se generó
// con el resumen de IA apagado (solo fetch + ranking, ver generate-brief.ts).
const categoryItem = z.object({
  title: z.string(),
  source: z.string(),
  source_url: z.string(),
  why: z.string().default(""),
});

export const briefSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // false cuando este brief se generó con el toggle "Resumen con IA" apagado
  // — la UI lo usa para mostrar el aviso en vez de Top 5/Extras vacíos.
  aiEnabled: z.boolean().default(true),
  top5: z.array(storyItem).default([]),
  // Antes eran 5 keys fijas (ai_tech/cloud/business/investments/peru_geopolitics)
  // — ahora es un mapa dinámico porque los temas son configurables (tabla
  // brief_temas), la key es `brief_temas.clave`.
  categories: z.record(z.string(), z.array(categoryItem)).default({}),
  explore_further: z
    .array(
      z.object({
        topic: z.string(),
        why_care: z.string(),
        what_problem_it_solves: z.string(),
      })
    )
    .default([]),
  one_thing_to_learn: z
    .object({
      concept: z.string(),
      explanation: z.string(),
    })
    .nullable()
    .default(null),
  opportunities: z
    .array(
      z.object({
        idea: z.string(),
        signal: z.string(),
      })
    )
    .default([]),
  rabbit_hole: z
    .array(
      z.object({
        topic: z.string(),
        reason: z.string(),
      })
    )
    .default([]),
});

export type Brief = z.infer<typeof briefSchema>;
export type StoryItem = z.infer<typeof storyItem>;
export type CategoryItem = z.infer<typeof categoryItem>;
