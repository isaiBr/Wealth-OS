import Link from "next/link";
import {
  agruparPorBucket,
  cuotasActivas,
  deudaPendiente,
  gastoHormigaAnualizado,
  listarCategorias,
  listarCuentas,
  obtenerFondoEmergencia,
  patrimonioHistorico,
  presupuestoPorCategoria,
  resumenMes,
  saldoCuenta,
  suscripcionesDelMes,
  transaccionesDelMes,
} from "@/db/queries";
import { evaluarInsights } from "@/logic/insights";
import { deltaMonto, deltaPuntos } from "@/logic/comparaciones";

export const dynamic = "force-dynamic";

const FORMATO = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BUCKETS: { clave: string; nombre: string; color: string; descripcion: string }[] = [
  { clave: "fijos", nombre: "Costos fijos", color: "var(--ink)", descripcion: "Vivienda, servicios, deudas" },
  { clave: "inversion", nombre: "Inversiones", color: "var(--accent)", descripcion: "Aportes de inversión" },
  { clave: "ahorro", nombre: "Ahorro", color: "var(--cat-3)", descripcion: "Fondo de emergencia y metas" },
  { clave: "libre", nombre: "Gasto libre", color: "var(--warn)", descripcion: "Sin culpa: salidas, gustos, hobbies" },
];

const ICONO_SUSCRIPCIONES = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 3v6h-6" />
  </svg>
);
const ICONO_CUOTAS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2 2 7l10 5 10-5-10-5Z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </svg>
);
const ICONO_DEUDA = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12h8" />
  </svg>
);
const ICONO_ALERTA = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
    <path d="M12 9v4M12 17h.01M10.3 3.9 2.7 17.1a1.8 1.8 0 0 0 1.6 2.7h15.4a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" />
  </svg>
);

function mesActual(): string {
  return new Date().toISOString().slice(0, 7);
}

function mesAnteriorDe(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  return m === 1 ? `${anio - 1}-12` : `${anio}-${String(m - 1).padStart(2, "0")}`;
}

function nombreMes(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PE", { month: "long" }).format(new Date(anio, m - 1, 1));
}

function estadoBarra(pct: number | null): "" | "warn" | "over" {
  if (pct === null) return "";
  if (pct >= 100) return "over";
  if (pct >= 80) return "warn";
  return "";
}

function formatHora(fechaIso: string): string {
  return new Date(fechaIso).toLocaleTimeString("es-PE", { hour: "numeric", minute: "2-digit", hour12: true });
}

export default async function InicioPage() {
  const mes = mesActual();
  const cuentas = await listarCuentas();
  const saldos = await Promise.all(cuentas.map((c) => saldoCuenta(c.id)));
  // "Líquidas" excluye tarjetas de crédito — esas son deuda, no plata disponible.
  const saldoTotal = cuentas.reduce((acc, c, i) => (c.tipo === "tarjeta_credito" ? acc : acc + saldos[i]), 0);
  const destacadas = cuentas
    .map((c, i) => ({ cuenta: c, saldo: saldos[i] }))
    .filter((x) => x.cuenta.destacada);
  const resumen = await resumenMes(mes);
  const recientes = (await transaccionesDelMes(mes, 50, 0)).slice(0, 3);
  const { filas: presupuesto, sinCategorizar } = await presupuestoPorCategoria(mes);
  const [fondo, gastoHormiga] = await Promise.all([
    obtenerFondoEmergencia(),
    gastoHormigaAnualizado(mes),
  ]);
  const insights = evaluarInsights({ presupuesto, sinCategorizar, resumen, fondo, gastoHormiga });
  const categorias = await listarCategorias();
  const cuentaPorId = new Map(cuentas.map((c) => [c.id, c]));
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));

  const tasaAhorro = resumen.ingresos > 0 ? ((resumen.ingresos - resumen.gastos) / resumen.ingresos) * 100 : null;

  // --- Plan de gasto consciente (solo montos reales, sin meta) ---
  const porBucket = agruparPorBucket(presupuesto);
  const pctGastosFijos = resumen.gastos > 0 ? ((porBucket.fijos ?? 0) / resumen.gastos) * 100 : 0;

  // --- Comparación vs. mes anterior (mockup: "mensajitos" bajo cada stat) ---
  const mesPrev = mesAnteriorDe(mes);
  const resumenPrev = await resumenMes(mesPrev);
  const nombreMesPrev = nombreMes(mesPrev);
  // Sin datos del mes anterior (recién empezando a usar la app) no hay con
  // qué comparar — se omite el delta en vez de mostrar "+100% vs. nada".
  let deltaIngresos: ReturnType<typeof deltaMonto> | null = null;
  let deltaGastos: ReturnType<typeof deltaMonto> | null = null;
  let deltaTasaAhorro: ReturnType<typeof deltaPuntos> | null = null;
  let deltaPctFijos: ReturnType<typeof deltaPuntos> | null = null;
  if (resumenPrev.total > 0) {
    deltaIngresos = deltaMonto(resumen.ingresos, resumenPrev.ingresos, "mayorEsMejor", nombreMesPrev);
    deltaGastos = deltaMonto(resumen.gastos, resumenPrev.gastos, "mayorEsPeor", nombreMesPrev);

    const { filas: presupuestoPrev } = await presupuestoPorCategoria(mesPrev);
    const porBucketPrev = agruparPorBucket(presupuestoPrev);
    const tasaAhorroPrev =
      resumenPrev.ingresos > 0 ? ((resumenPrev.ingresos - resumenPrev.gastos) / resumenPrev.ingresos) * 100 : null;
    const pctGastosFijosPrev = resumenPrev.gastos > 0 ? ((porBucketPrev.fijos ?? 0) / resumenPrev.gastos) * 100 : 0;

    if (tasaAhorro !== null && tasaAhorroPrev !== null) {
      deltaTasaAhorro = deltaPuntos(tasaAhorro, tasaAhorroPrev, "mayorEsMejor", nombreMesPrev);
    }
    deltaPctFijos = deltaPuntos(pctGastosFijos, pctGastosFijosPrev, "mayorEsPeor", nombreMesPrev);
  }

  // --- Compromisos recurrentes ---
  const { totalMensual: totalCuotas } = await cuotasActivas();
  const deudas = await deudaPendiente();
  const totalDeuda = deudas.reduce((acc, d) => acc + d.saldo, 0);
  const { total: totalSuscripciones } = await suscripcionesDelMes(mes);

  // "Fijos pendientes" (facturas fijas aún no cobradas este mes) queda en 0
  // — no hay todavía un registro de gastos fijos recurrentes esperados con
  // fecha; cuotas y apartado de ahorro sí son calculables con datos reales.
  const fijosPendientes = 0;
  const apartadoAhorro = porBucket.ahorro ?? 0;
  // "Sin contabilizar" NO ajusta esto a propósito: si de verdad te reembolsan
  // (ver flujo esperado en la doc de la transacción), esa entrada se registra
  // como ingreso real y el saldo de cuenta ya queda correcto solo — inventar
  // un ajuste acá encima sería contarlo dos veces. Mientras no llegue el
  // reembolso, esa plata de verdad no está disponible hoy.
  const disponibleReal = saldoTotal - fijosPendientes - totalCuotas - apartadoAhorro;

  // --- Patrimonio neto: reconstruido de las transacciones, sin snapshots ---
  const patrimonio = await patrimonioHistorico(30);
  let trendSvg: { puntos: string; poligono: string } | null = null;
  let deltaPatrimonio: number | null = null;
  if (patrimonio.length >= 3) {
    const valores = patrimonio.map((p) => p.valor);
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const rango = max - min || 1;
    const ancho = 300;
    const alto = 84;
    const puntosArr = patrimonio.map((p, i) => {
      const x = (i / (patrimonio.length - 1)) * ancho;
      const y = alto - ((p.valor - min) / rango) * alto;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const puntos = puntosArr.join(" ");
    trendSvg = { puntos, poligono: `0,${alto} ${puntos} ${ancho},${alto}` };
    deltaPatrimonio = patrimonio[patrimonio.length - 1].valor - patrimonio[0].valor;
  }

  // --- Gasto por categoría (donut) ---
  const gastoPorCategoria = [...resumen.porCategoria.entries()]
    .filter(([id, monto]) => id !== null && monto > 0)
    .map(([id, monto]) => ({ categoria: categoriaPorId.get(id as number), monto }))
    .filter((x): x is { categoria: NonNullable<typeof x.categoria>; monto: number } => !!x.categoria)
    .sort((a, b) => b.monto - a.monto);
  const totalCategorizado = gastoPorCategoria.reduce((acc, c) => acc + c.monto, 0);
  const circunferencia = 2 * Math.PI * 54;
  let acumulado = 0;
  const arcos = gastoPorCategoria.map((c, i) => {
    const arcLen = totalCategorizado > 0 ? (c.monto / totalCategorizado) * circunferencia : 0;
    const arco = { ...c, arcLen, offset: -acumulado, color: `var(--cat-${(i % 6) + 1})` };
    acumulado += arcLen;
    return arco;
  });

  // --- Categorías a vigilar (mismo cálculo que Presupuesto, top 3) ---
  const aVigilar = presupuesto.slice(0, 3);

  return (
    <div className="screen">
      <div className="hero-row">
        <div className="card hero-primary">
          <div className="hero-eyebrow">Cada sol tiene un trabajo asignado</div>
          <div className="label">Disponible real hoy</div>
          <div className="valor tabular">S/ {disponibleReal.toFixed(2)}</div>
          <div className="desglose">
            <div className="row">
              <span>En cuentas líquidas</span>
              <b className="tabular">S/ {saldoTotal.toFixed(2)}</b>
            </div>
            {totalCuotas > 0 && (
              <div className="row">
                <span>− Cuotas de tarjeta este mes</span>
                <b className="tabular">S/ {totalCuotas.toFixed(2)}</b>
              </div>
            )}
            {apartadoAhorro > 0 && (
              <div className="row">
                <span>− Apartado para tu ahorro del mes</span>
                <b className="tabular">S/ {apartadoAhorro.toFixed(2)}</b>
              </div>
            )}
          </div>
          {cuentas.length === 0 && (
            <p style={{ marginTop: 12, fontSize: 12, color: "var(--hero-muted)" }}>
              Sin cuentas todavía —{" "}
              <Link href="/cuentas" style={{ color: "var(--hero-accent)" }}>
                agrega una en Cuentas
              </Link>
              .
            </p>
          )}
        </div>

        {trendSvg && (
          <div className="card hero-secondary">
            <div className="top-row">
              <div>
                <div className="label">Patrimonio neto</div>
                <div className="valor tabular">S/ {patrimonio[patrimonio.length - 1].valor.toFixed(2)}</div>
                {deltaPatrimonio !== null && (
                  <div className="delta tabular">
                    {deltaPatrimonio >= 0 ? "+" : "−"}S/ {Math.abs(deltaPatrimonio).toFixed(2)} en {patrimonio.length} días
                  </div>
                )}
              </div>
            </div>
            <div className="trend-wrap">
              <svg viewBox="0 0 300 84" preserveAspectRatio="none">
                <polygon points={trendSvg.poligono} fill="var(--accent-soft)" />
                <polyline points={trendSvg.puntos} fill="none" stroke="var(--accent)" strokeWidth="2" />
              </svg>
            </div>
            <div className="trend-axis">Últimos {patrimonio.length} días</div>
          </div>
        )}
      </div>

      {insights.length > 0 && (
        <div className="insights-row">
          {insights.map((insight, i) => (
            <div className={`insight ${insight.tipo}`} key={i} title={insight.largo}>
              <div className="insight-icon" aria-hidden="true" />
              <div className="insight-body">
                <div className="insight-eyebrow">{insight.eyebrow}</div>
                <div className="insight-num tabular">{insight.numero}</div>
                <div className="insight-label">{insight.corto}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="stats-label">Tu mes en números</div>
      <div className="stats-grid">
        <div className="stat">
          <div className="label">Ingreso del mes</div>
          <div className="valor tabular">S/ {resumen.ingresos.toFixed(2)}</div>
          {deltaIngresos && <div className={`delta tabular ${deltaIngresos.clase}`}>{deltaIngresos.texto}</div>}
        </div>
        <div className="stat">
          <div className="label">Gasto real</div>
          <div className="valor tabular">S/ {resumen.gastos.toFixed(2)}</div>
          {deltaGastos && <div className={`delta tabular ${deltaGastos.clase}`}>{deltaGastos.texto}</div>}
        </div>
        <div className="stat">
          <div className="label">Tasa de ahorro</div>
          <div className="valor tabular">{tasaAhorro === null ? "—" : `${tasaAhorro.toFixed(0)}%`}</div>
          {deltaTasaAhorro && <div className={`delta tabular ${deltaTasaAhorro.clase}`}>{deltaTasaAhorro.texto}</div>}
        </div>
        <div className="stat">
          <div className="label">Gastos fijos</div>
          <div className="valor tabular">{pctGastosFijos.toFixed(0)}%</div>
          {deltaPctFijos && <div className={`delta tabular ${deltaPctFijos.clase}`}>{deltaPctFijos.texto}</div>}
        </div>
      </div>

      <div className="stats-label">Compromisos recurrentes</div>
      <div className="commit-row">
        <Link href="/presupuesto" className="commit-chip">
          <div className="commit-icon" aria-hidden="true">
            {ICONO_SUSCRIPCIONES}
          </div>
          <div className="commit-body">
            <span className="commit-label">Suscripciones</span>
            <span className="commit-val tabular">S/ {totalSuscripciones.toFixed(2)}</span>
          </div>
        </Link>
        <Link href="/presupuesto" className="commit-chip">
          <div className="commit-icon" aria-hidden="true">
            {ICONO_CUOTAS}
          </div>
          <div className="commit-body">
            <span className="commit-label">Cuotas activas</span>
            <span className="commit-val tabular">S/ {totalCuotas.toFixed(2)}</span>
          </div>
        </Link>
        <Link href="/cuentas" className={`commit-chip${totalDeuda > 0 ? " warn" : ""}`}>
          <div className="commit-icon" aria-hidden="true">
            {ICONO_DEUDA}
          </div>
          <div className="commit-body">
            <span className="commit-label">Deuda pendiente</span>
            <span className="commit-val tabular">S/ {totalDeuda.toFixed(2)}</span>
          </div>
        </Link>
      </div>

      <div className="dashboard-grid">
      <div className="col-main">
      {gastoPorCategoria.length > 0 && (
        <>
          <div className="section-head">
            <div>
              <div className="section-title">Gasto por categoría</div>
              <div className="section-sub">S/ {FORMATO.format(totalCategorizado)} en total este mes</div>
            </div>
          </div>
          <div className="card chart-card">
            <div className="donut-row">
              <svg viewBox="0 0 140 140" width="140" height="140">
                <g transform="rotate(-90 70 70)">
                  {arcos.map((a) => (
                    <circle
                      key={a.categoria.id}
                      cx="70"
                      cy="70"
                      r="54"
                      fill="none"
                      stroke={a.color}
                      strokeWidth="16"
                      strokeDasharray={`${a.arcLen} ${circunferencia - a.arcLen}`}
                      strokeDashoffset={a.offset}
                    />
                  ))}
                </g>
              </svg>
              <div className="legend">
                {arcos.map((a) => (
                  <div className="legend-item" key={a.categoria.id}>
                    <span className="legend-dot" style={{ background: a.color }} />
                    <span className="nombre">{a.categoria.nombre}</span>
                    <span className="pct">
                      {totalCategorizado > 0 ? ((a.monto / totalCategorizado) * 100).toFixed(0) : 0}% · S/ {FORMATO.format(a.monto)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {aVigilar.length > 0 && (
        <>
          <div className="section-head with-action">
            <div className="section-title">Categorías a vigilar</div>
            <Link href="/presupuesto" className="text-link">
              Ver más
            </Link>
          </div>
          <div className="card">
            {aVigilar.map(({ categoria, gasto, pctUsado, sinMovimiento }) => {
              const estado = estadoBarra(pctUsado);
              return (
                <div className={`cat-row${sinMovimiento ? " zero" : ""}`} key={categoria.id}>
                  <div className="cat-top">
                    <span>{categoria.nombre}</span>
                    <span className="cifras">
                      {categoria.limiteMensual ? (
                        <>
                          <strong className="tabular">S/ {FORMATO.format(gasto)}</strong>
                          {` / S/ ${FORMATO.format(categoria.limiteMensual)}`}
                        </>
                      ) : (
                        <Link href="/presupuesto" className="text-link">
                          Configura un límite →
                        </Link>
                      )}
                    </span>
                  </div>
                  {!sinMovimiento && categoria.limiteMensual !== null && (
                    <div className="cat-bar-track">
                      <div className={`cat-bar-fill ${estado}`} style={{ width: `${Math.min(100, pctUsado ?? 0)}%` }} />
                    </div>
                  )}
                  {estado === "over" && categoria.limiteMensual !== null && (
                    <div className="cat-flag over">
                      {ICONO_ALERTA}
                      S/ {FORMATO.format(gasto - categoria.limiteMensual)} sobre el presupuesto
                    </div>
                  )}
                  {estado === "warn" && <div className="cat-flag warn">{ICONO_ALERTA}Cerca del límite</div>}
                  {sinMovimiento && <div className="cat-zero-note">Sin movimiento este mes</div>}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="section-head with-action">
        <div className="section-title">Plan de gasto consciente</div>
        <Link href="/presupuesto" className="text-link">
          Ver más
        </Link>
      </div>
      <div className="card">
        {BUCKETS.map((b) => {
          const monto = porBucket[b.clave] ?? 0;
          const pct = resumen.gastos > 0 ? (monto / resumen.gastos) * 100 : 0;
          return (
            <div className="plan-row" key={b.clave}>
              <span className="dot" style={{ background: b.color }} />
              <div className="info">
                <div className="nombre">{b.nombre}</div>
                <div className="meta">{b.descripcion}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: b.color }} />
                </div>
              </div>
              <div className="pct tabular">{pct.toFixed(0)}%</div>
            </div>
          );
        })}
      </div>

      <div className="section-head with-action">
        <div className="section-title">Movimientos recientes</div>
        <Link href="/movimientos" className="text-link">
          Ver más
        </Link>
      </div>
      <div className="card" style={{ padding: "6px 18px" }}>
        {recientes.length === 0 ? (
          <p className="empty-note">Sin movimientos este mes todavía.</p>
        ) : (
          recientes.map((t) => {
            const cuenta = cuentaPorId.get(t.cuentaId);
            const categoria = t.categoriaId ? categoriaPorId.get(t.categoriaId) : undefined;
            const esIngreso = t.tipo === "ingreso" || t.tipo === "devolucion" || (t.tipo === "ajuste" && t.monto >= 0);
            return (
              <div className={`tx${t.esTransferenciaInterna ? " transfer" : ""}`} key={t.id}>
                <div className="tx-left">
                  <div className="tx-info">
                    <span className="tx-merchant" style={{ cursor: "default" }}>
                      {t.comercio || "(sin descripción)"}
                    </span>
                    <div className="tx-meta">
                      {cuenta && (
                        <span className={`banco-tag tag-${cuenta.banco}`}>{cuenta.banco.slice(0, 3).toUpperCase()}</span>
                      )}
                      <span className="tx-hours">{formatHora(t.fecha)}</span>
                      {t.esTransferenciaInterna ? (
                        <span className="tx-cat-pill transfer">Transferencia interna</span>
                      ) : (
                        <span className="tx-cat-pill">{categoria?.nombre ?? "Sin categoría"}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className={`tx-amount tabular${esIngreso ? " income" : ""}`}>
                  {esIngreso ? "+ " : "− "}S/ {Math.abs(t.monto).toFixed(2)}
                </div>
              </div>
            );
          })
        )}
      </div>
      </div>

      <div className="col-side">
      <div className="section-head with-action">
        <div className="section-title">Cuentas</div>
        <Link href="/cuentas" className="text-link">
          Ver más
        </Link>
      </div>
      <div className="cuentas">
        {destacadas.length === 0 ? (
          <p className="empty-note">
            {cuentas.length === 0
              ? "Sin cuentas registradas."
              : "Ninguna cuenta marcada como destacada todavía — hazlo desde Cuentas."}
          </p>
        ) : (
          destacadas.map(({ cuenta, saldo }) => (
            <div className="cuenta" key={cuenta.id}>
              <div className="banco">
                <span className={`banco-tag tag-${cuenta.banco}`}>{cuenta.banco.slice(0, 3).toUpperCase()}</span>
                <div className="cuenta-info">
                  <div className="nombre-cuenta">
                    {cuenta.nombre}
                    {cuenta.billetera && <span className={`wallet-tag tag-${cuenta.billetera}`}>{cuenta.billetera === "yape" ? "Yape" : "Plin"}</span>}
                  </div>
                </div>
              </div>
              <div className="saldo tabular">S/ {saldo.toFixed(2)}</div>
            </div>
          ))
        )}
      </div>
      </div>
      </div>
    </div>
  );
}
