import {
  deudaPendiente,
  listarCobranzas,
  listarCuentas,
  listarDeudasManuales,
  obtenerFondoEmergencia,
  saldoCuenta,
} from "@/db/queries";
import { CuentasView } from "./CuentasView";
import { FondoEmergenciaView } from "./FondoEmergenciaView";
import { CobranzasView } from "./CobranzasView";
import { DeudasView } from "./DeudasView";
import { TabPillsGroup, TabPanel } from "@/components/TabPills";

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
      billetera: c.billetera,
      saldo: await saldoCuenta(c.id),
    }))
  );
  const fondo = await obtenerFondoEmergencia();
  const deudas = await deudaPendiente();
  const cobranzas = await listarCobranzas();
  const deudasManuales = await listarDeudasManuales();

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-title">Cuentas</div>
        <div className="screen-sub">Saldo reconstruido: saldo inicial + movimientos detectados — no es un pull en vivo del banco.</div>
      </div>
      <TabPillsGroup
        ariaLabel="Secciones de Cuentas"
        tabs={[
          { key: "cuentas", label: "Cuentas" },
          { key: "cobranzas", label: "Cobranzas" },
          { key: "deudas", label: "Deudas" },
          { key: "fondo", label: "Fondo" },
        ]}
      >
        <div className="dashboard-grid">
          <div className="col-main">
            <TabPanel tabKey="cuentas">
              <CuentasView cuentas={cuentasConSaldo} />
            </TabPanel>
          </div>
          <div className="col-side">
            <TabPanel tabKey="fondo">
              <FondoEmergenciaView fondo={fondo} cuentas={cuentas.map((c) => ({ id: c.id, nombre: c.nombre }))} />
            </TabPanel>

            <TabPanel tabKey="deudas">
              <DeudasView deudasTarjeta={deudas} deudasManuales={deudasManuales} />
            </TabPanel>

            <TabPanel tabKey="cobranzas">
              <CobranzasView cobranzas={cobranzas} />
            </TabPanel>
          </div>
        </div>
      </TabPillsGroup>
    </div>
  );
}
