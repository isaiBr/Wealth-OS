import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { interbankParser } from "../src/parsers/interbank";

const dir = join(__dirname, "..", "correos-ejemplo");
const archivos = readdirSync(dir).filter((f) => f.endsWith(".txt"));

for (const archivo of archivos) {
  const contenido = readFileSync(join(dir, archivo), "utf-8");
  const primeraLinea = contenido.split(/\r?\n/)[0];
  const email = {
    from: "Interbank Servicio al Cliente <servicioalcliente@netinterbank.com.pe>",
    subject: primeraLinea,
    body: contenido,
  };

  console.log(`\n=== ${archivo} ===`);
  if (!interbankParser.puedeParsear(email)) {
    console.log("puedeParsear() = false (no debería pasar, remitente hardcodeado)");
    continue;
  }
  const resultados = interbankParser.parsearTodos(email);
  if (resultados.length === 0) {
    console.log("Sin match — ningún tipo reconocido.");
    continue;
  }
  for (const r of resultados) {
    console.log(JSON.stringify(r, null, 2));
  }
}
