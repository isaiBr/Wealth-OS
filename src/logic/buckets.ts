// Buckets del Plan de gasto consciente — cada categoría pertenece a uno
// (campo `bucket` en categorias, editable en Configuración). Compartido para
// que el selector de categoría en 2 pasos (TransaccionForm) y los acordeones
// de Configuración usen siempre el mismo orden/etiqueta.
export const BUCKETS_ORDEN = ["fijos", "inversion", "ahorro", "libre"] as const;

export const BUCKET_LABEL: Record<string, string> = {
  fijos: "Costos fijos",
  inversion: "Inversiones",
  ahorro: "Ahorro",
  libre: "Gasto libre",
};
