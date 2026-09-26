"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Categoria, Tag } from "@/db/queries";

const DEBOUNCE_BUSQUEDA_MS = 500;

interface Props {
  categorias: Categoria[];
  tags: Tag[];
}

export function MovimientosFiltros({ categorias, tags }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [texto, setTexto] = useState(searchParams.get("q") ?? "");
  const esPrimerRender = useRef(true);

  function actualizar(clave: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set(clave, valor);
    else params.delete(clave);
    router.push(`${pathname}?${params.toString()}`);
  }

  // Busca sola tras dejar de escribir, sin botón — se salta el primer
  // render para no re-navegar al valor que ya viene de la URL.
  useEffect(() => {
    if (esPrimerRender.current) {
      esPrimerRender.current = false;
      return;
    }
    const timer = setTimeout(() => actualizar("q", texto.trim()), DEBOUNCE_BUSQUEDA_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  const categoriaId = searchParams.get("categoriaId") ?? "";
  const tagId = searchParams.get("tagId") ?? "";
  const q = searchParams.get("q") ?? "";
  const hayFiltros = categoriaId !== "" || tagId !== "" || q !== "";

  function limpiarFiltros() {
    const mes = searchParams.get("mes");
    setTexto("");
    router.push(mes ? `${pathname}?mes=${mes}` : pathname);
  }

  return (
    <div className="mov-filtros">
      <select
        className="mov-filtro-select"
        aria-label="Filtrar por categoría"
        value={categoriaId}
        onChange={(e) => actualizar("categoriaId", e.target.value)}
      >
        <option value="">Todas las categorías</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>

      <select
        className="mov-filtro-select"
        aria-label="Filtrar por etiqueta"
        value={tagId}
        onChange={(e) => actualizar("tagId", e.target.value)}
      >
        <option value="">Todas las etiquetas</option>
        {tags.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>

      <div className="mov-filtro-texto">
        <input
          type="text"
          aria-label="Buscar por comercio"
          placeholder="Buscar comercio..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>

      {hayFiltros && (
        <button type="button" className="text-link" onClick={limpiarFiltros}>
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
