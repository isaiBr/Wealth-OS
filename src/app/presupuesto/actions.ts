"use server";

import { revalidatePath } from "next/cache";
import { editarLimiteCategoria } from "@/db/queries";

export async function editarLimiteAction(formData: FormData) {
  const categoriaId = Number(formData.get("categoriaId"));
  const raw = String(formData.get("limiteMensual") ?? "").trim();
  const limiteMensual = raw === "" ? null : parseFloat(raw);

  if (!categoriaId || (limiteMensual !== null && Number.isNaN(limiteMensual))) {
    throw new Error("Datos de límite inválidos");
  }

  await editarLimiteCategoria(categoriaId, limiteMensual);
  revalidatePath("/presupuesto");
  revalidatePath("/");
}
