import { listarCuentas, saldoCuenta } from "@/db/queries";
import { CuentasView } from "./CuentasView";

export const dynamic = "force-dynamic";

export default async function CuentasPage() {
  const cuentas = await listarCuentas();
  const cuentasConSaldo = await Promise.all(
    cuentas.map(async (c) => ({
      id: c.id,
      nombre: c.nombre,
      banco: c.banco,
      tipo: c.tipo,
      destacada: c.destacada,
      saldo: await saldoCuenta(c.id),
    }))
  );

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-title">Cuentas</div>
        <div className="screen-sub">Saldo reconstruido: saldo inicial + movimientos detectados — no es un pull en vivo del banco.</div>
      </div>
      <CuentasView cuentas={cuentasConSaldo} />
    </div>
  );
}
