import Link from "next/link";
import { listarCuentas, presupuestoPorCategoria, resumenMes, saldoCuenta, transaccionesDelMes } from "@/db/queries";
import { evaluarInsights } from "@/logic/insights";

export const dynamic = "force-dynamic";

function mesActual(): string {
  return new Date().toISOString().slice(0, 7);
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
  const recientes = (await transaccionesDelMes(mes)).slice(0, 3);
  const { filas: presupuesto, sinCategorizar } = await presupuestoPorCategoria(mes);
  const insights = evaluarInsights({ presupuesto, sinCategorizar, resumen });

  const tasaAhorro = resumen.ingresos > 0 ? ((resumen.ingresos - resumen.gastos) / resumen.ingresos) * 100 : null;

  return (
    <div className="screen">
      <div className="hero-row">
        <div className="card hero-primary">
          <div className="hero-eyebrow">Cada sol tiene un trabajo asignado</div>
          <div className="label">Disponible real hoy</div>
          <div className="valor tabular">S/ {saldoTotal.toFixed(2)}</div>
          <div className="desglose">
            <div className="row">
              <span>En cuentas líquidas</span>
              <b className="tabular">S/ {saldoTotal.toFixed(2)}</b>
            </div>
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

      <div className="stats-grid">
        <div className="stat">
          <div className="label">Ingreso del mes</div>
          <div className="valor tabular">S/ {resumen.ingresos.toFixed(2)}</div>
        </div>
        <div className="stat">
          <div className="label">Gasto real</div>
          <div className="valor tabular">S/ {resumen.gastos.toFixed(2)}</div>
        </div>
        <div className="stat">
          <div className="label">Tasa de ahorro</div>
          <div className="valor tabular">{tasaAhorro === null ? "—" : `${tasaAhorro.toFixed(0)}%`}</div>
        </div>
        <div className="stat">
          <div className="label">Movimientos</div>
          <div className="valor tabular">{resumen.total}</div>
        </div>
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
          recientes.map((t) => (
            <div className="tx" key={t.id}>
              <div className="tx-left">
                <div className="tx-info">
                  <span className="tx-merchant" style={{ cursor: "default" }}>
                    {t.comercio || "(sin descripción)"}
                  </span>
                </div>
              </div>
              <div className={`tx-amount tabular${t.tipo === "ingreso" || t.tipo === "devolucion" ? " income" : ""}`}>
                {t.tipo === "ingreso" || t.tipo === "devolucion" ? "+ " : "− "}S/ {t.monto.toFixed(2)}
              </div>
            </div>
          ))
        )}
      </div>

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
                <span className="banco-tag">{cuenta.banco.slice(0, 3).toUpperCase()}</span>
                <div className="cuenta-info">
                  <div className="nombre-cuenta">{cuenta.nombre}</div>
                </div>
              </div>
              <div className="saldo tabular">S/ {saldo.toFixed(2)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
