import {
  deudaPendiente,
  listarCobranzas,
  listarCuentas,
  listarDeudasManuales,
  listarIdentificadoresCuenta,
  obtenerFondoEmergencia,
  saldoCuenta,
} from "@/db/queries";
import { CuentasView } from "./CuentasView";
import { FondoEmergenciaView } from "./FondoEmergenciaView";
import { CobranzasView } from "./CobranzasView";
import { DeudasView } from "./DeudasView";
import { TabPillsGroup, TabPanel } from "@/components/TabPills";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function CuentasPage({ searchParams }: Props) {
  const params = await searchParams;
  const cuentas = await listarCuentas();
  const cuentasConSaldo = await Promise.all(
    cuentas.map(async (c) => ({
      id: c.id,
      nombre: c.nombre,
      banco: c.banco,
      tipo: c.tipo,
      destacada: c.destacada,
      billetera: c.billetera,
      incluirEnLiquidas: c.incluirEnLiquidas,
      saldo: await saldoCuenta(c.id),
    }))
  );
  const fondo = await obtenerFondoEmergencia();
  const deudas = await deudaPendiente();
  const cobranzas = await listarCobranzas();
  const deudasManuales = await listarDeudasManuales();
  const identificadores = await listarIdentificadoresCuenta();
  const identificadoresPorCuenta: Record<number, { id: number; ultimosDigitos: string }[]> = {};
  for (const idf of identificadores) {
    (identificadoresPorCuenta[idf.cuentaId] ??= []).push({ id: idf.id, ultimosDigitos: idf.ultimosDigitos });
  }

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
        initialTab={params.tab}
      >
        <TabPanel tabKey="cuentas">
          <CuentasView cuentas={cuentasConSaldo} identificadoresPorCuenta={identificadoresPorCuenta} />
        </TabPanel>

        <TabPanel tabKey="fondo">
          <FondoEmergenciaView fondo={fondo} cuentas={cuentas.map((c) => ({ id: c.id, nombre: c.nombre }))} />
        </TabPanel>

        <TabPanel tabKey="deudas">
          <DeudasView deudasTarjeta={deudas} deudasManuales={deudasManuales} />
        </TabPanel>

        <TabPanel tabKey="cobranzas">
          <CobranzasView cobranzas={cobranzas} />
        </TabPanel>
      </TabPillsGroup>
    </div>
  );
}
