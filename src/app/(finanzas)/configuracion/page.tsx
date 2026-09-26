import { listarCategorias, listarReglasCategorizacion, listarTags, obtenerConfiguracionIA } from "@/db/queries";
import { ConfiguracionView } from "./ConfiguracionView";
import { ReglasCategorizacionView } from "./ReglasCategorizacionView";
import { TabPillsGroup, TabPanel } from "@/components/TabPills";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ConfiguracionPage({ searchParams }: Props) {
  const params = await searchParams;
  const categorias = await listarCategorias();
  const reglas = await listarReglasCategorizacion();
  const tags = await listarTags();
  const configuracion = await obtenerConfiguracionIA();

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-title">Configuración</div>
        <div className="screen-sub">
          Categorías, etiquetas y reglas de categorización — personaliza cómo Wealth OS organiza tus movimientos.
        </div>
      </div>
      <TabPillsGroup
        ariaLabel="Secciones de Configuración"
        tabs={[
          { key: "categorias", label: "Categorías" },
          { key: "etiquetas", label: "Etiquetas" },
          { key: "reglas", label: "Reglas" },
        ]}
        initialTab={params.tab}
      >
        <ConfiguracionView categorias={categorias} tags={tags} />
        <TabPanel tabKey="reglas">
          <ReglasCategorizacionView categorias={categorias} reglas={reglas} configuracion={configuracion} />
        </TabPanel>
      </TabPillsGroup>
    </div>
  );
}
