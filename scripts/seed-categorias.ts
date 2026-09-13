import { config } from "dotenv";
config({ path: ".env.local" });

const DEFAULT: { nombre: string; bucket: "fijos" | "inversion" | "ahorro" | "libre" }[] = [
  { nombre: "Alimentación", bucket: "libre" },
  { nombre: "Restaurantes", bucket: "libre" },
  { nombre: "Transporte", bucket: "libre" },
  { nombre: "Servicios", bucket: "fijos" },
  { nombre: "Vivienda", bucket: "fijos" },
  { nombre: "Suscripciones", bucket: "fijos" },
  { nombre: "Entretenimiento", bucket: "libre" },
  { nombre: "Salud", bucket: "libre" },
  { nombre: "Ahorro", bucket: "ahorro" },
  { nombre: "Inversión", bucket: "inversion" },
  { nombre: "Ingreso", bucket: "libre" },
  { nombre: "Otros", bucket: "libre" },
];

async function main() {
  const { db } = await import("../src/db/client");
  const { categorias } = await import("../src/db/schema");
  for (const c of DEFAULT) {
    await db.insert(categorias).values(c).onConflictDoNothing();
  }
  console.log(`Sembradas ${DEFAULT.length} categorías (o ya existían).`);
}

main().then(() => process.exit(0));
