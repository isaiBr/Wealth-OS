// Carga .env.test.local (solo TURSO_DATABASE_URL/TURSO_AUTH_TOKEN apuntando a
// la BD local de pruebas) ANTES de levantar el comando que sigue. dotenv no
// pisa variables que ya existan en process.env, y Next/drizzle-kit tampoco
// pisan las que ya vienen seteadas al leer .env.local — así el resto de
// secretos (Clerk, Anthropic, Gmail) se sigue tomando de .env.local normal,
// sin duplicarlos acá.
require("dotenv").config({ path: ".env.test.local" });

const { spawn } = require("child_process");

const [, , cmd, ...args] = process.argv;
const child = spawn(cmd, args, { stdio: "inherit", env: process.env, shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
