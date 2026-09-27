import Anthropic from "@anthropic-ai/sdk";
import { eq, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { briefs } from "@/db/schema";
import { briefSchema, type Brief } from "./brief-schema";
import { listarTemas, obtenerConfiguracionBrief, type BriefTema } from "./queries";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Retención: no tiene sentido guardar noticias viejas para siempre, y cada
// fila es un JSON completo (~15-25KB). 30 días de historial es de sobra para
// mirar hacia atrás sin que la tabla crezca sin límite.
const RETENCION_DIAS = 30;

const MODEL = "claude-haiku-4-5-20251001";

// --- Fetch de candidatos (gratis, sin LLM) ----------------------------------
// RSS de Google News por tema — reemplaza la tool web_search abierta que
// usaba el Daily Brief original. Ver docs/plan-reestructuracion-multidominio.md
// §2.12 para el porqué (costo: ~$1/día con web_search abierto vs. centavos acá).

type Candidato = { title: string; source: string; link: string; clave: string };

async function fetchTemaRSS(tema: BriefTema): Promise<Candidato[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(tema.query + " when:1d")}&hl=es-419&gl=PE&ceid=PE:es-419`;
  const res = await fetch(url);
  const xml = await res.text();
  const items: Candidato[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) && items.length < 25) {
    const block = m[1];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
    const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "";
    const source = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || "";
    if (title) items.push({ title: decodeXml(title), source: decodeXml(source), link, clave: tema.clave });
  }
  return items;
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function enrichSnippet(link: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(link, { redirect: "follow", signal: controller.signal });
    clearTimeout(t);
    const html = await res.text();
    const og = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
    const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
    return (og?.[1] || desc?.[1] || null)?.slice(0, 500) ?? null;
  } catch {
    return null;
  }
}

// --- Ranking sin IA (gratis) -------------------------------------------------
// Usado cuando brief_configuracion.resumen_con_ia está apagado: sin ningún
// llamado a Claude, solo el orden que ya trae Google (su propio ranking de
// relevancia) + de-duplicado por similitud de texto entre títulos del mismo
// tema. Ver §2.12 — en la práctica la señal de "cobertura" rara vez encuentra
// duplicados exactos, así que esto termina siendo cercano al orden de Google.
function palabrasSignificativas(titulo: string): Set<string> {
  return new Set(
    titulo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

function similitud(a: Set<string>, b: Set<string>): number {
  let comunes = 0;
  for (const w of a) if (b.has(w)) comunes++;
  return comunes / Math.min(a.size, b.size || 1);
}

function rankearSinIA(pool: Candidato[], cantidad: number): Candidato[] {
  const sets = pool.map((c) => palabrasSignificativas(c.title));
  const conCobertura = pool.map((c, i) => {
    let cobertura = 0;
    for (let j = 0; j < pool.length; j++) {
      if (i !== j && similitud(sets[i], sets[j]) > 0.5) cobertura++;
    }
    return { candidato: c, cobertura, posicion: i };
  });
  conCobertura.sort((a, b) => b.cobertura - a.cobertura || a.posicion - b.posicion);

  const top: Candidato[] = [];
  for (const { candidato } of conCobertura) {
    const duplicado = top.some((t) => similitud(palabrasSignificativas(t.title), palabrasSignificativas(candidato.title)) > 0.5);
    if (!duplicado) top.push(candidato);
    if (top.length >= cantidad) break;
  }
  return top;
}

async function generarSinIA(date: string, temas: BriefTema[]): Promise<Brief> {
  const pools = await Promise.all(temas.map((t) => fetchTemaRSS(t)));
  const categories: Brief["categories"] = {};
  temas.forEach((tema, i) => {
    const top = rankearSinIA(pools[i], tema.cantidad);
    categories[tema.clave] = top.map((c) => ({ title: c.title, source: c.source, source_url: c.link, why: "" }));
  });
  return briefSchema.parse({ date, aiEnabled: false, top5: [], categories });
}

// --- Extracción de JSON tolerante --------------------------------------------
// Los LLMs a veces dejan una coma colgando antes de `}`/`]` — JSON.parse no
// lo tolera, así que se limpia antes de parsear en vez de fallar la corrida.
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const sinComasColgando = candidate.replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(sinComasColgando);
}

// --- Generación con IA (barata: Haiku, sin tools) ----------------------------
async function generarConIA(date: string, temas: BriefTema[]): Promise<Brief> {
  const pools = await Promise.all(temas.map((t) => fetchTemaRSS(t)));
  const all: Candidato[] = pools.flat();

  const listText = all.map((c, i) => `${i}. [${c.clave}] ${c.title} — ${c.source}`).join("\n");
  const reparto = temas.map((t) => `${t.clave}: ${t.cantidad}`).join(", ");

  const filterResp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: `Eres un editor de noticias. Te doy una lista numerada de titulares del día, cada uno con su tema entre corchetes, para un ingeniero de software en Lima, Perú. Elige EXACTAMENTE esta cantidad de titulares por tema (no más, no menos salvo que el tema tenga menos candidatos de los pedidos): ${reparto}. Evita duplicados de la misma historia dentro de un mismo tema. Nunca dejes un tema en 0 si tiene al menos un candidato razonable. Devuelve SOLO un JSON: {"selected": [indices]} sin texto adicional.`,
    messages: [{ role: "user", content: listText }],
  });
  const filterText = filterResp.content.find((b) => b.type === "text")?.text ?? "{}";
  console.log("[brief] tokens filtro:", filterResp.usage);
  const selectedIdx: number[] = (extractJson(filterText) as { selected?: number[] }).selected ?? [];
  const selected = selectedIdx.map((i) => all[i]).filter(Boolean);

  const enriched = await Promise.all(
    selected.map(async (c) => ({ ...c, snippet: await enrichSnippet(c.link) }))
  );

  const synthInput = enriched
    .map((c, i) => `${i}. [${c.clave}] ${c.title} — ${c.source}\n   snippet: ${c.snippet ?? "(sin snippet, usa el titular)"}`)
    .join("\n\n");
  const clavesDisponibles = temas.map((t) => t.clave).join(", ");

  const synthResp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: `Eres un analista de inteligencia personal. Con la lista de noticias de hoy (título + snippet + tema), arma un Daily Intelligence Brief para un ingeniero de software en Lima, Perú. No traduzcas títulos ni contenido que venga en inglés, déjalo tal cual.

"top5": elige las 5 historias más importantes del día EN GENERAL (pueden venir de cualquier tema, y sí, se pueden repetir de las que van en "categories"). Cada una lleva análisis completo: distingue HECHO (lo confirmado) / INTERPRETACIÓN (por qué importa) / PREDICCIÓN (qué podría pasar, opcional) — nunca presentes una predicción como hecho. Formato: {"title","summary","why_it_matters","context","what_could_change","facts_vs_interpretation","source","source_url"}.

"categories": TODAS las noticias que te pasé, agrupadas por su tema (keys válidas: ${clavesDisponibles}) — no te saltes ninguna. Formato liviano, sin análisis: {"title","source","source_url","why"} donde "why" es una sola frase corta de por qué vale la pena mirarla.

Devuelve SOLO un JSON con esta forma (sin texto fuera del JSON, sin coma colgando al final de arrays/objetos):
{
  "date": "${date}",
  "top5": [{"title":"...","summary":"...","why_it_matters":"...","context":"...","what_could_change":"...","facts_vs_interpretation":"...","source":"...","source_url":"..."}],
  "categories": { ${temas.map((t) => `"${t.clave}": [{"title":"...","source":"...","source_url":"...","why":"..."}]`).join(", ")} },
  "explore_further": [{"topic":"...","why_care":"...","what_problem_it_solves":"..."}],
  "one_thing_to_learn": {"concept":"...","explanation":"..."},
  "opportunities": [{"idea":"...","signal":"..."}],
  "rabbit_hole": [{"topic":"...","reason":"..."}]
}`,
    messages: [{ role: "user", content: synthInput }],
  });
  const synthText = synthResp.content.find((b) => b.type === "text")?.text ?? "{}";
  console.log("[brief] tokens sintesis:", synthResp.usage);
  const parsed = extractJson(synthText) as Record<string, unknown>;
  return briefSchema.parse({ ...parsed, date, aiEnabled: true });
}

export async function generateBrief(date: string): Promise<Brief> {
  const [temas, configuracion] = await Promise.all([listarTemas(), obtenerConfiguracionBrief()]);
  const temasActivos = temas.filter((t) => t.activo);
  if (temasActivos.length === 0) {
    return briefSchema.parse({ date, aiEnabled: configuracion.resumenConIa, top5: [], categories: {} });
  }
  return configuracion.resumenConIa ? generarConIA(date, temasActivos) : generarSinIA(date, temasActivos);
}

/**
 * Genera el brief de `date` y lo guarda en `briefs` — comparte esta lógica el
 * cron (api/cron/brief-generate) y el botón "Generar ahora" de Configuración,
 * para no duplicar el chequeo de "ya existe" / `force`.
 */
export async function generarYGuardarBrief(date: string, force = false): Promise<{ status: "ok" | "skipped" }> {
  if (!force) {
    const existente = await db.select({ id: briefs.id }).from(briefs).where(eq(briefs.date, date)).limit(1);
    if (existente.length > 0) return { status: "skipped" };
  }

  const brief = await generateBrief(date);
  const rawJson = JSON.stringify(brief);

  if (force) {
    await db.delete(briefs).where(eq(briefs.date, date));
  }
  await db.insert(briefs).values({ date, rawJson });
  await limpiarBriefsAntiguos();
  return { status: "ok" };
}

/** Borra briefs de hace más de `dias` días — ver RETENCION_DIAS. `date` es texto "YYYY-MM-DD", el orden lexicográfico ya sirve para comparar. */
async function limpiarBriefsAntiguos(dias = RETENCION_DIAS): Promise<void> {
  const limite = new Date();
  limite.setDate(limite.getDate() - dias);
  const limiteStr = limite.toISOString().slice(0, 10);
  await db.delete(briefs).where(lt(briefs.date, limiteStr));
}
