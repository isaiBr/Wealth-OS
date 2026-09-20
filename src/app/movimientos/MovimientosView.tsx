"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { TransaccionForm } from "@/components/TransaccionForm";
import { obtenerTransaccionesAction, alternarTagAction, alternarExcluidaAction, crearYAsignarTagAction } from "./actions";
import type { Cuenta, Categoria, Transaccion, Tag } from "@/db/queries";

interface Props {
  cuentas: Cuenta[];
  categorias: Categoria[];
  transacciones: Transaccion[];
  tags: Tag[];
  tagsPorTxInicial: Map<number, Tag[]>;
  mes: string;
}

const FORMATO_DIA = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short" });
const FORMATO_MONTO = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatHora(fechaIso: string): string {
  return new Date(fechaIso).toLocaleTimeString("es-PE", { hour: "numeric", minute: "2-digit", hour12: true });
}

function etiquetaDia(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  const mismodia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (mismodia(fecha, hoy)) return "Hoy";
  if (mismodia(fecha, ayer)) return "Ayer";
  return FORMATO_DIA.format(fecha);
}

export function MovimientosView({ cuentas, categorias, transacciones: inicial, tags, tagsPorTxInicial, mes }: Props) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Transaccion | undefined>(undefined);
  const [gestionandoId, setGestionandoId] = useState<number | null>(null);
  const [transacciones, setTransacciones] = useState(inicial);
  const [tagsPorTx, setTagsPorTx] = useState(tagsPorTxInicial);
  const [inicialAnterior, setInicialAnterior] = useState(inicial);
  const [offset, setOffset] = useState(50);
  const [cargando, setCargando] = useState(false);
  const [hayMas, setHayMas] = useState(inicial.length === 50);
  const [tagsDisponibles, setTagsDisponibles] = useState(tags);
  const [tagsAnterior, setTagsAnterior] = useState(tags);
  const [nuevoTagTexto, setNuevoTagTexto] = useState("");
  const [creandoTag, setCreandoTag] = useState(false);

  // Mismo patrón que `inicial` arriba: si Configuración crea/archiva una
  // etiqueta en paralelo, la próxima revalidación trae `tags` actualizado.
  if (tags !== tagsAnterior) {
    setTagsAnterior(tags);
    setTagsDisponibles(tags);
  }

  // `inicial` cambia cada vez que el servidor re-renderiza esta pantalla con
  // datos frescos (ej. después de editar una transacción, que invalida la
  // ruta con revalidatePath). El estado local de más arriba solo se usa para
  // poder ir agregando páginas con "Cargar más" — sin este ajuste, quedaría
  // pegado a la primera carga y no reflejaría ediciones hasta desmontar el
  // componente (cambiar de tab y volver). Se ajusta durante el render en vez
  // de con useEffect (patrón recomendado por React para "resetear estado
  // cuando cambia una prop" — evita una vuelta extra de render/commit).
  if (inicial !== inicialAnterior) {
    setInicialAnterior(inicial);
    setTransacciones(inicial);
    setTagsPorTx(tagsPorTxInicial);
    setOffset(50);
    setHayMas(inicial.length === 50);
  }

  const cuentaPorId = new Map(cuentas.map((c) => [c.id, c]));
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
  const gestionando = transacciones.find((t) => t.id === gestionandoId);

  const grupos = new Map<string, Transaccion[]>();
  for (const t of transacciones) {
    const dia = t.fecha.slice(0, 10);
    if (!grupos.has(dia)) grupos.set(dia, []);
    grupos.get(dia)!.push(t);
  }
  const diasOrdenados = Array.from(grupos.keys()).sort((a, b) => (a < b ? 1 : -1));

  function abrirEdicion(t: Transaccion) {
    setEditando(t);
    setModalAbierto(true);
  }

  function abrirCreacion() {
    setEditando(undefined);
    setModalAbierto(true);
  }

  async function cargarMas() {
    setCargando(true);
    try {
      const { transacciones: nuevas, tagsPorTx: tagsNuevos } = await obtenerTransaccionesAction(mes, offset);
      setTransacciones([...transacciones, ...nuevas]);
      setTagsPorTx(new Map([...tagsPorTx, ...tagsNuevos]));
      setOffset(offset + 50);
      setHayMas(nuevas.length === 50);
    } finally {
      setCargando(false);
    }
  }

  // Toque = cambio, al toque. Sin esperar el round-trip: se actualiza el
  // estado local ya mismo y la acción de servidor corre atrás.
  function toggleTag(transaccionId: number, tag: Tag) {
    const actuales = tagsPorTx.get(transaccionId) ?? [];
    const activo = actuales.some((t) => t.id === tag.id);
    const nuevoMapa = new Map(tagsPorTx);
    nuevoMapa.set(transaccionId, activo ? actuales.filter((t) => t.id !== tag.id) : [...actuales, tag]);
    setTagsPorTx(nuevoMapa);
    alternarTagAction(transaccionId, tag.id, !activo);
  }

  function toggleExcluida(t: Transaccion) {
    const nuevoValor = !t.excluida;
    setTransacciones(transacciones.map((x) => (x.id === t.id ? { ...x, excluida: nuevoValor } : x)));
    alternarExcluidaAction(t.id, nuevoValor);
  }

  async function crearYAsignarTag(transaccionId: number) {
    const nombre = nuevoTagTexto.trim();
    if (!nombre) return;
    setCreandoTag(true);
    try {
      const tag = await crearYAsignarTagAction(transaccionId, nombre);
      setTagsDisponibles((actuales) => (actuales.some((t) => t.id === tag.id) ? actuales : [...actuales, tag]));
      const actuales = tagsPorTx.get(transaccionId) ?? [];
      if (!actuales.some((t) => t.id === tag.id)) {
        const nuevoMapa = new Map(tagsPorTx);
        nuevoMapa.set(transaccionId, [...actuales, tag]);
        setTagsPorTx(nuevoMapa);
      }
      setNuevoTagTexto("");
    } finally {
      setCreandoTag(false);
    }
  }

  return (
    <>
      <div className="toolbar-row">
        <span className="section-sub">
          {transacciones.length} movimiento{transacciones.length === 1 ? "" : "s"} este mes
        </span>
        <button
          className="btn-add"
          type="button"
          onClick={abrirCreacion}
          disabled={cuentas.length === 0}
          title={cuentas.length === 0 ? "Primero crea una cuenta en la pestaña Cuentas" : undefined}
        >
          + Agregar gasto manual
        </button>
      </div>

      <div className="card" style={{ padding: "6px 18px" }}>
        {diasOrdenados.length === 0 && (
          <p className="empty-note">
            Sin movimientos todavía. {cuentas.length === 0 && "Crea una cuenta primero en la pestaña Cuentas."}
          </p>
        )}
        {diasOrdenados.map((dia) => (
          <div key={dia}>
            <div className="tx-day-label">{etiquetaDia(grupos.get(dia)![0].fecha)}</div>
            {grupos.get(dia)!.map((t) => {
              const cuenta = cuentaPorId.get(t.cuentaId);
              const categoria = t.categoriaId ? categoriaPorId.get(t.categoriaId) : undefined;
              const esIngreso = t.tipo === "ingreso" || t.tipo === "devolucion" || (t.tipo === "ajuste" && t.monto >= 0);
              const tagsDeEsta = tagsPorTx.get(t.id) ?? [];
              return (
                <div className={`tx${t.esTransferenciaInterna ? " transfer" : ""}`} key={t.id}>
                  <div className="tx-left">
                    <div className="tx-info">
                      {t.tipo === "ajuste" ? (
                        <span className="tx-merchant" style={{ cursor: "default" }}>
                          {t.comercio || "(sin descripción)"}
                        </span>
                      ) : (
                        <button className="tx-merchant" type="button" onClick={() => abrirEdicion(t)}>
                          {t.comercio || "(sin descripción)"}
                        </button>
                      )}
                      <div className="tx-meta">
                        {cuenta && (
                          <span className={`banco-tag tag-${cuenta.banco}`}>{cuenta.banco.slice(0, 3).toUpperCase()}</span>
                        )}
                        <span className="tx-hours">{formatHora(t.fecha)}</span>
                        {t.esTransferenciaInterna ? (
                          <span className="tx-cat-pill transfer">Transferencia interna</span>
                        ) : t.tipo === "ajuste" ? (
                          <span className="tx-cat-pill">Ajuste de saldo</span>
                        ) : (
                          <span className={`tx-cat-pill${categoria && !t.categoriaConfirmada ? " suggested" : ""}`}>
                            {categoria?.nombre ?? "Sin categoría"}
                          </span>
                        )}
                        {t.excluida && <span className="tx-cat-pill excluded">Sin contabilizar</span>}
                        {tagsDeEsta.map((tag) => (
                          <span className="tx-tag-pill" key={tag.id}>
                            {tag.nombre}
                          </span>
                        ))}
                        <button
                          className="tx-tag-pill add"
                          type="button"
                          aria-label={`Etiquetas y "sin contabilizar" de ${t.comercio || "este movimiento"}`}
                          onClick={() => setGestionandoId(t.id)}
                        >
                          + etiqueta
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className={`tx-amount tabular${esIngreso ? " income" : ""}`}>
                    {esIngreso ? "+ " : "− "}S/ {FORMATO_MONTO.format(Math.abs(t.monto))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {hayMas && (
          <div style={{ padding: "12px 0", textAlign: "center" }}>
            <button
              className="btn-secondary"
              onClick={cargarMas}
              disabled={cargando}
              style={{ width: "100%" }}
            >
              {cargando ? "Cargando..." : "Cargar más movimientos ↓"}
            </button>
          </div>
        )}
      </div>

      {modalAbierto && (
        <TransaccionForm cuentas={cuentas} categorias={categorias} transaccion={editando} onClose={() => setModalAbierto(false)} />
      )}

      {gestionando && (
        <Modal onClose={() => setGestionandoId(null)}>
          <h2 className="serif" style={{ fontSize: 19, marginBottom: 16 }}>
            {gestionando.comercio || "(sin descripción)"}
          </h2>
          <div className="field">
            <label>Etiquetas</label>
            <div className="tag-cloud">
              {tagsDisponibles.length === 0 && (
                <span className="section-sub" style={{ margin: 0 }}>
                  Sin etiquetas todavía — creá una abajo.
                </span>
              )}
              {tagsDisponibles.map((tag) => {
                const activo = (tagsPorTx.get(gestionando.id) ?? []).some((t) => t.id === tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={`tx-tag-pill toggle${activo ? " active" : ""}`}
                    onClick={() => toggleTag(gestionando.id, tag)}
                  >
                    {tag.nombre}
                  </button>
                );
              })}
            </div>
            <form
              style={{ display: "flex", gap: 8, marginTop: 10 }}
              onSubmit={(e) => {
                e.preventDefault();
                crearYAsignarTag(gestionando.id);
              }}
            >
              <input
                type="text"
                placeholder="Nueva etiqueta..."
                value={nuevoTagTexto}
                onChange={(e) => setNuevoTagTexto(e.target.value)}
                disabled={creandoTag}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn-secondary" disabled={creandoTag || !nuevoTagTexto.trim()}>
                + Crear
              </button>
            </form>
            <span className="section-sub" style={{ margin: "6px 0 0", display: "block" }}>
              Para eliminar una etiqueta, andá a Configuración.
            </span>
          </div>
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="excluida-quick" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                id="excluida-quick"
                type="checkbox"
                checked={gestionando.excluida}
                onChange={() => toggleExcluida(gestionando)}
              />
              Sin contabilizar (excluir de totales de gasto/ingreso)
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-primary" onClick={() => setGestionandoId(null)}>
              Listo
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
