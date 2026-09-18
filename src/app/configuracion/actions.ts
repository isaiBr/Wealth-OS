"use server";

import { revalidatePath } from "next/cache";
import {
  crearCategoria,
  editarCategoria,
  archivarCategoria,
  eliminarReglaCategorizacion,
  crearTag,
  eliminarTag,
  actualizarConfiguracionIA,
} from "@/db/queries";
import type { ConfiguracionIa } from "@/db/queries";

function revalidarTodo() {
  revalidatePath("/configuracion");
  revalidatePath("/movimientos");
  revalidatePath("/presupuesto");
  revalidatePath("/");
}

export async function crearCategoriaAction(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const bucket = String(formData.get("bucket") ?? "");
  if (!nombre || !bucket) throw new Error("Faltan datos de la categoría");
  await crearCategoria(nombre, bucket);
  revalidarTodo();
}

export async function editarCategoriaAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const nombre = String(formData.get("nombre") ?? "").trim();
  const bucket = String(formData.get("bucket") ?? "");
  if (!id || !nombre || !bucket) throw new Error("Faltan datos de la categoría");
  await editarCategoria(id, nombre, bucket);
  revalidarTodo();
}

export async function archivarCategoriaAction(id: number, archivada: boolean) {
  await archivarCategoria(id, archivada);
  revalidarTodo();
}

export async function eliminarReglaAction(id: number) {
  await eliminarReglaCategorizacion(id);
  revalidarTodo();
}

export async function crearTagAction(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) throw new Error("Falta el nombre de la etiqueta");
  await crearTag(nombre);
  revalidarTodo();
}

export async function eliminarTagAction(id: number) {
  await eliminarTag(id);
  revalidarTodo();
}

export async function actualizarConfiguracionIAAction(input: Partial<ConfiguracionIa>) {
  await actualizarConfiguracionIA(input);
  revalidarTodo();
}
