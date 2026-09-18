import { listarCategorias, listarReglasCategorizacion, listarTags, obtenerConfiguracionIA } from "@/db/queries";
import { ConfiguracionView } from "./ConfiguracionView";
import { ReglasCategorizacionView } from "./ReglasCategorizacionView";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
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
      <div className="dashboard-grid">
        <div className="col-main">
          <ConfiguracionView categorias={categorias} tags={tags} />
        </div>
        <div className="col-side">
          <ReglasCategorizacionView categorias={categorias} reglas={reglas} configuracion={configuracion} />
        </div>
      </div>
    </div>
  );
}
