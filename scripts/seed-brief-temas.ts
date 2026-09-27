import { config } from "dotenv";
config({ path: ".env.local" });

const DEFAULT: { nombre: string; clave: string; query: string; cantidad: number; orden: number }[] = [
  { nombre: "IA y tecnología", clave: "ai_tech", query: "inteligencia artificial OR IA tecnologia", cantidad: 3, orden: 0 },
  { nombre: "Cloud", clave: "cloud", query: "cloud computing OR Azure OR AWS", cantidad: 3, orden: 1 },
  { nombre: "Negocios", clave: "business", query: "negocios empresas economia", cantidad: 3, orden: 2 },
  { nombre: "Inversiones", clave: "investments", query: "inversiones mercados bolsa", cantidad: 3, orden: 3 },
  { nombre: "Perú y geopolítica", clave: "peru_geopolitics", query: "Peru politica economia", cantidad: 3, orden: 4 },
];

async function main() {
  const { db } = await import("../src/db/client");
  const { briefTemas, briefConfiguracion } = await import("../src/db/schema");
  for (const t of DEFAULT) {
    await db.insert(briefTemas).values(t).onConflictDoNothing();
  }
  const existing = await db.select().from(briefConfiguracion).limit(1);
  if (existing.length === 0) {
    await db.insert(briefConfiguracion).values({ resumenConIa: true });
  }
  console.log(`Sembrados ${DEFAULT.length} temas de Brief (o ya existían) + configuración por defecto.`);
}

main().then(() => process.exit(0));
