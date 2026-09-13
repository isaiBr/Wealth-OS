import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bcpParser } from "../src/parsers/bcp";

const dir = join(__dirname, "..", "correos-ejemplo");
const archivos = readdirSync(dir).filter((f) => f.startsWith("bcp -") && f.endsWith(".txt"));

for (const archivo of archivos) {
  const contenido = readFileSync(join(dir, archivo), "utf-8");
  const [, resto] = contenido.split("De: ");
  const [remitente, restoSinRemitente] = resto.split("\nAsunto: ");
  const [asunto, cuerpo] = restoSinRemitente.split("\n---\n");

  const email = { from: remitente.trim(), subject: asunto.trim(), body: cuerpo };

  console.log(`\n=== ${archivo} ===`);
  if (!bcpParser.puedeParsear(email)) {
    console.log("puedeParsear() = false");
    continue;
  }
  const resultado = bcpParser.parsear(email);
  console.log(resultado ? JSON.stringify(resultado, null, 2) : "Sin match.");
}
