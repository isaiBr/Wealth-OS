import { config } from "dotenv";
config({ path: ".env.local" });

// Mapeo de últimos 4 dígitos de cuenta (según el usuario) -> nombre real.
const DIGITOS_A_CUENTA: Record<string, { nombre: string; saldoActual: number; destacada: boolean; moneda?: string }> = {
  "1051": { nombre: "Cuenta de ahorro (principal)", saldoActual: 19, destacada: true },
  "3088": { nombre: "Ahorro soles (poco uso)", saldoActual: 0, destacada: false },
  "4009": { nombre: "Ahorro soles (cuenta sueldo)", saldoActual: 905, destacada: true },
  "2130": { nombre: "Ahorro dólares", saldoActual: 2.76, destacada: false, moneda: "USD" },
  "4014": { nombre: "Corriente soles", saldoActual: 0, destacada: false },
  "6096": { nombre: "CTS Soles", saldoActual: 0.34, destacada: false },
};

const TARJETA_DEBITO_A_CUENTA: Record<string, string> = {
  "5526": "1051", // confirmado por el usuario
};
const TARJETA_CREDITO = "1305";

function extraerDigitosOrigen(body: string): string | null {
  const m =
    body.match(/Desde\s+[^\n]+\n\*+\s*(\d{4})/i) ??
    body.match(/Cuenta de origen:?\s*[^\n]+\n\*+\s*(\d{4})/i);
  return m?.[1] ?? null;
}

function extraerDigitosDestino(body: string): string | null {
  const m = body.match(/Enviado a\s+[^\n]+\n\*+\s*(\d{4})/i);
  return m?.[1] ?? null;
}

// Compras a plazos activas, reportadas a mano por el usuario (no llegan por
// correo como tal — el banco solo informa la cuota mensual en el estado de
// cuenta). fechaCompra es aproximada cuando no se dio la fecha exacta.
const COMPRAS_CUOTAS_CONOCIDAS = [
  {
    comercio: "Gimnasio B2",
    montoTotal: 1799,
    montoCuota: 299.83,
    totalCuotas: 6,
    cuotasPagadas: 0, // empieza a pagarse el próximo ciclo
    fechaCompra: "2026-09-01", // aproximada — no se dio la fecha exacta
  },
  {
    comercio: "Mantenimiento carro Astaar",
    montoTotal: 254.38 * 6,
    montoCuota: 254.38,
    totalCuotas: 6,
    cuotasPagadas: 4, // la 5ta se paga este mes (18), quedan 2 pendientes
    fechaCompra: "2026-04-01", // aproximada — no se dio la fecha exacta
  },
];

async function main() {
  const { db } = await import("../src/db/client");
  const { cuentas, transacciones, tarjetas, comprasCuotas } = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");
  const { bcpParser } = await import("../src/parsers/bcp");
  const { interbankParser } = await import("../src/parsers/interbank");
  const { RAW_EMAILS } = await import("./data/correos-septiembre");
  const { pareceNombrePropio } = await import("../src/logic/transferencia-interna");
  const { categorizar } = await import("../src/categorizacion/reglas");
  const { categorias } = await import("../src/db/schema");
  const { TIPO_CAMBIO_USD_PEN } = await import("../src/config/moneda");

  const todasLasCategorias = await db.select().from(categorias);
  const categoriaIdPorNombre = new Map(todasLasCategorias.map((c) => [c.nombre, c.id]));

  console.log("Borrando transacciones, cuentas, tarjetas y cuotas existentes (recarga limpia)...");
  await db.delete(comprasCuotas);
  await db.delete(tarjetas);
  await db.delete(transacciones);
  await db.delete(cuentas);

  // 1. Crear las cuentas BCP reales con saldo inicial en 0 temporalmente
  //    (se corrige al final, una vez sabemos qué transacciones cayeron en cada una).
  const idPorDigitos: Record<string, number> = {};
  for (const [digitos, info] of Object.entries(DIGITOS_A_CUENTA)) {
    const [nueva] = await db
      .insert(cuentas)
      .values({
        nombre: info.nombre,
        banco: "bcp",
        tipo: "ahorro",
        saldoInicial: 0,
        destacada: info.destacada,
      })
      .returning();
    idPorDigitos[digitos] = nueva.id;
  }

  const [cuentaInterbank] = await db
    .insert(cuentas)
    .values({ nombre: "Cuenta Simple", banco: "interbank", tipo: "ahorro", saldoInicial: 0, destacada: true })
    .returning();

  const [cuentaTarjetaBcp] = await db
    .insert(cuentas)
    .values({ nombre: "Tarjeta de Crédito BCP", banco: "bcp", tipo: "tarjeta_credito", saldoInicial: 0, destacada: false })
    .returning();

  // Ciclo de facturación reportado por el usuario: cierre el 25, nuevo
  // ciclo el 26, pago el 18 del mes siguiente al cierre. fechaVencimiento
  // se recalcula a mano cada vez que se corre este script — no hay lógica
  // de recurrencia todavía (ver roadmap §7).
  const [tarjetaCreditoBcp] = await db
    .insert(tarjetas)
    .values({
      cuentaId: cuentaTarjetaBcp.id,
      nombre: "Tarjeta de Crédito BCP",
      banco: "bcp",
      fechaVencimiento: "2026-10-18",
    })
    .returning();

  for (const compra of COMPRAS_CUOTAS_CONOCIDAS) {
    await db.insert(comprasCuotas).values({
      tarjetaId: tarjetaCreditoBcp.id,
      comercio: compra.comercio,
      montoTotal: compra.montoTotal,
      montoCuota: compra.montoCuota,
      totalCuotas: compra.totalCuotas,
      cuotasPagadas: compra.cuotasPagadas,
      fechaCompra: compra.fechaCompra,
    });
  }

  // 2. Parsear e insertar, resolviendo la cuenta real de cada transacción.
  const netoPorCuenta: Record<number, number> = {};
  function acumular(cuentaId: number, tipo: string, monto: number) {
    const signo = tipo === "ingreso" || tipo === "devolucion" ? 1 : -1;
    netoPorCuenta[cuentaId] = (netoPorCuenta[cuentaId] ?? 0) + signo * monto;
  }

  let insertadas = 0;
  let convertidasUSD = 0;

  for (const email of RAW_EMAILS) {
    let parsed = null;
    if (bcpParser.puedeParsear(email)) parsed = bcpParser.parsear(email);
    else if (interbankParser.puedeParsear(email)) parsed = interbankParser.parsear(email);
    if (!parsed) continue;

    // Sin soporte multi-moneda todavía: se convierte a soles a un tipo de
    // cambio fijo dado por el usuario, en vez de omitir la transacción.
    let monto = parsed.monto;
    let descripcion = parsed.descripcion;
    if (parsed.moneda !== "PEN") {
      const montoOriginal = monto;
      monto = Math.round(monto * TIPO_CAMBIO_USD_PEN * 100) / 100;
      descripcion = [descripcion, `$${montoOriginal.toFixed(2)} USD @ ${TIPO_CAMBIO_USD_PEN}`]
        .filter(Boolean)
        .join(" — ");
      convertidasUSD++;
      console.log(
        `Convertida USD->PEN: ${parsed.comercio} $${montoOriginal.toFixed(2)} -> S/ ${monto.toFixed(2)} — op ${parsed.numeroOperacion}`
      );
    }

    let cuentaId: number;
    if (parsed.banco === "interbank") {
      cuentaId = cuentaInterbank.id;
    } else if (parsed.ultimosDigitosTarjeta === TARJETA_CREDITO) {
      cuentaId = cuentaTarjetaBcp.id;
    } else if (parsed.ultimosDigitosTarjeta && TARJETA_DEBITO_A_CUENTA[parsed.ultimosDigitosTarjeta]) {
      cuentaId = idPorDigitos[TARJETA_DEBITO_A_CUENTA[parsed.ultimosDigitosTarjeta]];
    } else {
      const digitosOrigen = extraerDigitosOrigen(email.body);
      if (digitosOrigen && idPorDigitos[digitosOrigen]) {
        cuentaId = idPorDigitos[digitosOrigen];
      } else {
        console.log(`No se pudo mapear a una cuenta BCP específica, va a la principal: ${parsed.comercio} — op ${parsed.numeroOperacion}`);
        cuentaId = idPorDigitos["1051"];
      }
    }

    // Heurística del roadmap §4/§9: si el comercio/destinatario es el propio
    // titular, es un candidato fuerte a transferencia interna aunque el
    // banco no lo etiquete explícitamente (a diferencia de "Transferencia
    // entre mis cuentas" de BCP, que ya viene marcada por el parser).
    const esTransferenciaInterna = parsed.esTransferenciaInterna || pareceNombrePropio(parsed.comercio);

    // Una devolución no es un gasto nuevo — no se le asigna categoría de
    // consumo (evita, ej., que una devolución de Uber infle "Transporte").
    const nombreCategoria =
      esTransferenciaInterna || parsed.tipo === "devolucion" ? null : categorizar(parsed.tipo, parsed.comercio);
    const categoriaId = nombreCategoria ? categoriaIdPorNombre.get(nombreCategoria) ?? null : null;

    // BCP nos dice explícitamente ambos lados de una "Transferencia entre
    // mis cuentas" — se resuelve la cuenta destino directo, sin necesidad
    // de adivinar por monto/fecha (a diferencia del motor de matching de
    // más abajo, que cubre los casos donde el banco NO lo etiqueta así).
    let cuentaDestinoId: number | null = null;
    if (parsed.esTransferenciaInterna && parsed.banco === "bcp") {
      const digitosDestino = extraerDigitosDestino(email.body);
      if (digitosDestino && idPorDigitos[digitosDestino]) {
        cuentaDestinoId = idPorDigitos[digitosDestino];
      }
    }

    await db.insert(transacciones).values({
      cuentaId,
      tipo: parsed.tipo,
      monto,
      moneda: "PEN",
      comercio: parsed.comercio,
      descripcion,
      fecha: parsed.fecha,
      numeroOperacion: parsed.numeroOperacion,
      categoriaId,
      categoriaConfirmada: categoriaId !== null,
      esTransferenciaInterna,
      cuentaDestinoId,
      fuente: "email",
      correoRaw: email.body,
    });
    acumular(cuentaId, parsed.tipo, monto);
    // El destino recibe el monto completo — se contabiliza como "ingreso"
    // solo para efectos del cálculo de saldo_inicial de esa cuenta.
    if (cuentaDestinoId !== null) acumular(cuentaDestinoId, "ingreso", monto);
    insertadas++;
  }

  // 3. Calcular saldo_inicial = saldo_actual_real - neto de lo ya cargado.
  for (const [digitos, id] of Object.entries(idPorDigitos)) {
    const info = DIGITOS_A_CUENTA[digitos];
    const neto = netoPorCuenta[id] ?? 0;
    const saldoInicial = info.saldoActual - neto;
    await db.update(cuentas).set({ saldoInicial }).where(eq(cuentas.id, id));
    console.log(
      `${info.nombre} (${digitos}): saldo actual S/ ${info.saldoActual} - neto septiembre S/ ${neto.toFixed(2)} => saldo_inicial S/ ${saldoInicial.toFixed(2)}`
    );
  }

  const netoInterbank = netoPorCuenta[cuentaInterbank.id] ?? 0;
  const saldoInicialInterbank = 176.06 - netoInterbank;
  await db.update(cuentas).set({ saldoInicial: saldoInicialInterbank }).where(eq(cuentas.id, cuentaInterbank.id));
  console.log(
    `Cuenta Simple (Interbank): saldo actual S/ 176.06 - neto septiembre S/ ${netoInterbank.toFixed(2)} => saldo_inicial S/ ${saldoInicialInterbank.toFixed(2)}`
  );

  console.log(`\nInsertadas: ${insertadas}, convertidas de USD: ${convertidasUSD}`);

  const { ejecutarMotorTransferencias } = await import("../src/db/queries");
  const encontrados = await ejecutarMotorTransferencias("2026-09");
  console.log(`Motor de matching (débito+crédito en cuentas distintas): ${encontrados} pares encontrados.`);
}

main().then(() => process.exit(0));
