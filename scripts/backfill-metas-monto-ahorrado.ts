import { config } from "dotenv";
config({ path: ".env.local" });

// Migración única (Fase 8+, ver docs/plan-correcciones-fase8-vinculos.md):
// antes de cortar la lógica que derivaba el progreso de las metas viejas
// desde `categoriaId` (movimientos de una categoría dedicada) o desde
// `compraCuotaId` (metodoPago='cuotas'), se congela ese número en
// `montoAhorrado` para no perderlo. Reproduce el mismo cálculo que tenía
// `listarMetasCompra` en src/db/queries.ts antes de simplificarse.
//
// Dry-run por default (solo imprime qué cambiaría). Aplica de verdad con:
//   npx tsx scripts/backfill-metas-monto-ahorrado.ts --apply

async function main() {
  // Import dinámico DESPUÉS de config(): db/client.ts lee TURSO_DATABASE_URL
  // al importarse, y un import estático se resuelve antes de que corra el
  // config() de arriba (hoisting de ESM) — rompería la carga del .env.
  const { db } = await import("../src/db/client");
  const { metasCompra, comprasCuotas, pagosCuota, transacciones } = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");

  async function progresoLegado(meta: typeof metasCompra.$inferSelect): Promise<number | null> {
    if (meta.metodoPago === "cuotas" && meta.compraCuotaId !== null) {
      const compra = await db.select().from(comprasCuotas).where(eq(comprasCuotas.id, meta.compraCuotaId)).get();
      if (!compra) return null;
      const pagos = await db.select().from(pagosCuota).where(eq(pagosCuota.compraCuotaId, compra.id));
      return (compra.cuotasPagadas + pagos.length) * compra.montoCuota;
    }
    if (meta.categoriaId !== null) {
      const txs = await db.select().from(transacciones).where(eq(transacciones.categoriaId, meta.categoriaId));
      return txs.reduce((acc, t) => acc + (t.esTransferenciaInterna || t.excluida ? 0 : t.monto), 0);
    }
    return null; // meta nueva — ya usa montoAhorrado, nada que migrar
  }

  const apply = process.argv.includes("--apply");
  const metas = await db.select().from(metasCompra);

  let cambios = 0;
  for (const meta of metas) {
    const progreso = await progresoLegado(meta);
    if (progreso === null) continue;
    const nuevo = Math.round(progreso * 100) / 100;
    console.log(
      `[${apply ? "APLICANDO" : "DRY-RUN"}] meta #${meta.id} "${meta.nombre}" — montoAhorrado ${meta.montoAhorrado} -> ${nuevo}`
    );
    cambios++;
    if (apply) {
      await db.update(metasCompra).set({ montoAhorrado: nuevo }).where(eq(metasCompra.id, meta.id));
    }
  }

  console.log(`\n${cambios} meta(s) con progreso legado ${apply ? "migradas" : "por migrar"}.`);
  if (!apply) console.log("Nada se escribió todavía — correr de nuevo con --apply para aplicar.");
}

main().then(() => process.exit(0));
