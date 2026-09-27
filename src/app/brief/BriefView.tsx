import type { Brief, CategoryItem, StoryItem } from "@/lib/brief/brief-schema";
import { TabPillsGroup, TabPanel } from "@/components/TabPills";

// Antes eran 5 keys fijas — ahora los temas son configurables (tabla
// brief_temas), así que solo estas son etiquetas "bonitas" para los temas
// por defecto; cualquier tema nuevo se muestra con su clave tal cual.
const CATEGORY_LABELS: Record<string, string> = {
  ai_tech: "IA y tecnología",
  cloud: "Cloud",
  business: "Negocios",
  investments: "Inversiones",
  peru_geopolitics: "Perú y geopolítica",
};

const CATEGORY_COLORS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)"];

function labelFor(clave: string): string {
  return CATEGORY_LABELS[clave] ?? clave;
}

function CategoryBar({ categories }: { categories: Brief["categories"] }) {
  const entries = Object.entries(categories)
    .map(([clave, items]) => ({ clave, count: items.length }))
    .filter((e) => e.count > 0);
  const total = entries.reduce((sum, e) => sum + e.count, 0);

  if (total === 0) return null;

  return (
    <>
      <div className="brief-catbar">
        {entries.map((e, i) => (
          <div
            key={e.clave}
            style={{ width: `${(e.count / total) * 100}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
          />
        ))}
      </div>
      <div className="brief-catbar-legend">{entries.map((e) => `${labelFor(e.clave)} ${e.count}`).join(" · ")}</div>
    </>
  );
}

function StoryCard({ story }: { story: StoryItem }) {
  return (
    <div className="card">
      <p className="brief-story-title">{story.title}</p>

      <div className="brief-triad-row hecho">
        <span className="brief-triad-tag">Hecho</span>
        <span className="brief-triad-text">{story.summary}</span>
      </div>
      <div className="brief-triad-row interp">
        <span className="brief-triad-tag">Interp.</span>
        <span className="brief-triad-text">{story.facts_vs_interpretation}</span>
      </div>
      <div className="brief-triad-row predic">
        <span className="brief-triad-tag">Predic.</span>
        <span className="brief-triad-text">{story.what_could_change}</span>
      </div>

      <div className="brief-story-why">
        <b>Por qué importa: </b>
        {story.why_it_matters}
      </div>
      <div className="brief-story-why">
        <b>Contexto: </b>
        {story.context}
      </div>

      <a href={story.source_url} target="_blank" rel="noopener noreferrer" className="brief-story-source">
        {story.source}
      </a>
    </div>
  );
}

function CategoryLink({ item }: { item: CategoryItem }) {
  return (
    <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="brief-cat-link">
      <p className="brief-cat-link-title">{item.title}</p>
      {item.why && <p className="brief-cat-link-why">{item.why}</p>}
      <span className="brief-cat-link-source">{item.source}</span>
    </a>
  );
}

function SectionHead({ title }: { title: string }) {
  return (
    <div className="section-head">
      <div className="section-title">{title}</div>
    </div>
  );
}

function CategorySections({ categories }: { categories: Brief["categories"] }) {
  const entries = Object.entries(categories).filter(([, items]) => items.length > 0);
  if (entries.length === 0) {
    return <p className="empty-note">Todavía no hay noticias por tema — revisá que haya temas activos en Configuración.</p>;
  }
  return (
    <>
      {entries.map(([clave, items]) => (
        <div key={clave} className="brief-cat-section">
          <SectionHead title={labelFor(clave)} />
          <div className="brief-extra-list">
            {items.map((item, i) => (
              <CategoryLink key={i} item={item} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export function BriefView({ brief }: { brief: Brief }) {
  if (!brief.aiEnabled) {
    return (
      <div>
        <CategoryBar categories={brief.categories} />
        <div className="card">
          <p className="brief-story-title">Resumen de IA apagado</p>
          <p className="brief-story-summary">
            Activá &quot;Resumen con IA&quot; en Configuración para ver el análisis del día (Hecho / Interpretación /
            Predicción) y el Top 5. Mientras tanto, estas son las noticias del día por tema, sin análisis.
          </p>
        </div>
        <div style={{ marginTop: 18 }}>
          <CategorySections categories={brief.categories} />
        </div>
        <div className="brief-footer-date">Brief del {brief.date}</div>
      </div>
    );
  }

  const hayExtras =
    brief.one_thing_to_learn !== null ||
    brief.explore_further.length > 0 ||
    brief.opportunities.length > 0 ||
    brief.rabbit_hole.length > 0;

  return (
    <div>
      <CategoryBar categories={brief.categories} />

      <TabPillsGroup
        ariaLabel="Secciones de Brief"
        className="brief-pills-group"
        tabs={[
          { key: "top5", label: "Top 5" },
          { key: "categorias", label: "Categorías" },
          { key: "extras", label: "Extras" },
        ]}
      >
        <TabPanel tabKey="top5">
          {brief.top5.length === 0 ? (
            <p className="empty-note">Sin Top 5 todavía.</p>
          ) : (
            <div className="brief-story-list">
              {brief.top5.map((story, i) => (
                <StoryCard key={i} story={story} />
              ))}
            </div>
          )}
        </TabPanel>

        <TabPanel tabKey="categorias">
          <CategorySections categories={brief.categories} />
        </TabPanel>

        <TabPanel tabKey="extras">
          {!hayExtras ? (
            <p className="empty-note">Sin extras hoy.</p>
          ) : (
            <>
              {brief.one_thing_to_learn && (
                <div className="brief-cat-section">
                  <SectionHead title="Algo para aprender hoy" />
                  <div className="card brief-extra-item">
                    <p className="brief-extra-topic">{brief.one_thing_to_learn.concept}</p>
                    <p>{brief.one_thing_to_learn.explanation}</p>
                  </div>
                </div>
              )}

              {brief.explore_further.length > 0 && (
                <div className="brief-cat-section">
                  <SectionHead title="3 cosas para explorar" />
                  <div className="brief-extra-list">
                    {brief.explore_further.map((item, i) => (
                      <div key={i} className="card brief-extra-item">
                        <p className="brief-extra-topic">{item.topic}</p>
                        <p>
                          <b>Por qué importa: </b>
                          {item.why_care}
                        </p>
                        <p>
                          <b>Qué problema resuelve: </b>
                          {item.what_problem_it_solves}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {brief.opportunities.length > 0 && (
                <div className="brief-cat-section">
                  <SectionHead title="Oportunidades" />
                  <div className="brief-extra-list">
                    {brief.opportunities.map((item, i) => (
                      <div key={i} className="card brief-extra-item">
                        <p className="brief-extra-topic">{item.idea}</p>
                        <p>{item.signal}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {brief.rabbit_hole.length > 0 && (
                <div className="brief-cat-section">
                  <SectionHead title="Rabbit hole" />
                  <div className="brief-extra-list">
                    {brief.rabbit_hole.map((item, i) => (
                      <div key={i} className="card brief-extra-item">
                        <p className="brief-extra-topic">{item.topic}</p>
                        <p>{item.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabPanel>
      </TabPillsGroup>

      <div className="brief-footer-date">Brief del {brief.date}</div>
    </div>
  );
}
