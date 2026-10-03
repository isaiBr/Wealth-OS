import { listarTemas, obtenerConfiguracionBrief } from "@/lib/brief/queries";
import { ConfigBriefView } from "./ConfigBriefView";

export const dynamic = "force-dynamic";

export default async function BriefConfigPage() {
  const [temas, configuracion] = await Promise.all([listarTemas(), obtenerConfiguracionBrief()]);

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-title">Configuración de Brief</div>
        <div className="screen-sub">Temas de interés y cuántas noticias querés garantizadas de cada uno por día</div>
      </div>
      <ConfigBriefView temas={temas} resumenConIa={configuracion.resumenConIa} generandoInicial={configuracion.generando} />
    </div>
  );
}
