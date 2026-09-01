/**
 * UnsplashPicker — panel inline de búsqueda en el banco de imágenes Unsplash
 * (docs/35 §2 Fase B). Se monta dentro de `ImageSourceField` cuando el
 * usuario elige la pestaña "Unsplash" (no es un modal — el canvas sigue
 * visible detrás del Inspector).
 *
 * Flujo: input con debounce 400ms → `searchImages` → grid de thumbnails con
 * scroll infinito (IntersectionObserver) → click en una foto → `downloadImage`
 * (el servidor registra el trigger de descarga por ToS de Unsplash) → blob a
 * data URL → `addAsset` (con atribución) → `setProp` → `onClose`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { searchImages, downloadImage, ApiError } from "@/services/apiClient";
import { CloseIcon, IconButton, Search } from "@/components";
import type { ImageSearchResult } from "../../../../shared/api";

const SEARCH_DEBOUNCE_MS = 400;

interface UnsplashPickerProps {
  /** Llamado con el resultado elegido; el picker no conoce `nodeId`/`fieldKey`. */
  onSelect: (result: ImageSearchResult, dataUrl: string) => void;
  onClose: () => void;
}

type FetchState = "idle" | "loading" | "loading-more" | "error";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("FileReader did not return a string result"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}

/** Deriva un nombre de archivo estable a partir del id de la foto. */
function fileNameForPhoto(photoId: string): string {
  return `unsplash-${photoId}.jpg`;
}

export function UnsplashPicker({ onSelect, onClose }: UnsplashPickerProps) {
  const { t } = useTranslation("inspector");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ImageSearchResult[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [state, setState] = useState<FetchState>("idle");
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const activeQueryRef = useRef("");
  const gridRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Evita disparos duplicados del IntersectionObserver mientras un fetch de
  // paginación está en curso: `state` se actualiza de forma asíncrona (tras
  // el render), así que el observer puede volver a dispararse con el mismo
  // `page` antes de que React refleje "loading-more" (bug real: Unsplash
  // devolvía la misma página dos veces → keys duplicadas en el grid).
  const fetchingRef = useRef(false);

  const runSearch = useCallback(async (q: string, nextPage: number, append: boolean) => {
    if (!q.trim()) {
      setResults([]);
      setTotalPages(0);
      setState("idle");
      return;
    }
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setState(append ? "loading-more" : "loading");
    try {
      const res = await searchImages(q.trim(), nextPage, 20);
      // Ignora respuestas fuera de orden si el usuario ya cambió la búsqueda.
      if (activeQueryRef.current !== q) return;
      setResults((prev) => {
        if (!append) return res.results;
        // Defensa adicional: Unsplash puede repetir fotos entre páginas
        // (o una foto de la página anterior) — deduplicar por id evita
        // keys duplicadas en el grid aunque el fetch en sí no se duplique.
        const seen = new Set(prev.map((r) => r.id));
        const deduped = res.results.filter((r) => !seen.has(r.id));
        return [...prev, ...deduped];
      });
      setTotalPages(res.totalPages);
      setPage(nextPage);
      setState("idle");
    } catch {
      if (activeQueryRef.current !== q) return;
      setState("error");
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  // Búsqueda con debounce al cambiar el query (docs/35 §2 Fase B UX).
  useEffect(() => {
    activeQueryRef.current = query;
    const handle = setTimeout(() => {
      void runSearch(query, 1, false);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, runSearch]);

  // Scroll infinito: observa un centinela al final del grid. `root` se fija
  // al propio grid (que tiene su scroll interno, `overflow-y: auto`) — sin
  // esto, IntersectionObserver usa el viewport del documento como referencia
  // por defecto, y como el editor completo puede no tener scroll de página,
  // el sentinel podía quedar "visible" (y disparar fetch) apenas se
  // renderizaba la primera página de resultados, sin que el usuario hubiera
  // scrolleado el panel — bug real reportado: la paginación se disparaba en
  // cascada en vez de esperar a que el usuario llegara al final del grid.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = gridRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          entry?.isIntersecting &&
          state === "idle" &&
          results.length > 0 &&
          page < totalPages
        ) {
          void runSearch(query, page + 1, true);
        }
      },
      { root, rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [page, totalPages, results.length, state, query, runSearch]);

  const handleSelect = useCallback(
    async (result: ImageSearchResult) => {
      setSelectingId(result.id);
      try {
        const blob = await downloadImage(result.id);
        const dataUrl = await blobToDataUrl(blob);
        onSelect(result, dataUrl);
      } catch {
        setSelectingId(null);
        setState("error");
      }
    },
    [onSelect],
  );

  return (
    <div className="pbx-unsplash">
      <div className="pbx-unsplash__header">
        <div className="pbx-unsplash__search">
          <Search size={14} className="pbx-unsplash__search-icon" aria-hidden="true" />
          <input
            className="pbx-control__input pbx-unsplash__search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("imageSource.unsplash.searchPlaceholder")}
            aria-label={t("imageSource.unsplash.searchAriaLabel")}
            autoFocus
          />
        </div>
        <IconButton
          icon={CloseIcon}
          label={t("imageSource.unsplash.close")}
          onClick={onClose}
        />
      </div>

      {state === "error" && (
        <p className="pbx-unsplash__error" role="alert">
          {t("imageSource.unsplash.error")}
        </p>
      )}

      {query.trim() === "" && results.length === 0 && state !== "error" && (
        <p className="pbx-unsplash__hint">{t("imageSource.unsplash.emptyInitial")}</p>
      )}

      {query.trim() !== "" && state === "loading" && results.length === 0 && (
        <p className="pbx-unsplash__hint">{t("imageSource.unsplash.loading")}</p>
      )}

      {query.trim() !== "" && state !== "loading" && state !== "error" && results.length === 0 && (
        <p className="pbx-unsplash__hint">{t("imageSource.unsplash.empty")}</p>
      )}

      {results.length > 0 && (
        <div
          ref={gridRef}
          className="pbx-unsplash__grid"
          role="list"
          aria-label={t("imageSource.unsplash.resultsGridAriaLabel")}
        >
          {results.map((result) => (
            <div key={result.id} className="pbx-unsplash__cell" role="listitem">
              <button
                type="button"
                className="pbx-unsplash__photo-btn"
                onClick={() => void handleSelect(result)}
                disabled={selectingId !== null}
                aria-label={t("imageSource.unsplash.selectPhotoAriaLabel", { name: result.author.name })}
                style={{ aspectRatio: `${result.width} / ${result.height}` }}
              >
                <img
                  className="pbx-unsplash__thumb"
                  src={result.urls.thumb}
                  alt={result.description ?? ""}
                  loading="lazy"
                />
                {selectingId === result.id && (
                  <span className="pbx-unsplash__selecting">
                    {t("imageSource.unsplash.selecting")}
                  </span>
                )}
              </button>
              <a
                className="pbx-unsplash__author"
                href={result.author.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                {t("imageSource.unsplash.photoBy", { name: result.author.name })}
              </a>
            </div>
          ))}
        </div>
      )}

      {state === "loading-more" && (
        <p className="pbx-unsplash__hint">{t("imageSource.unsplash.loadingMore")}</p>
      )}

      <div ref={sentinelRef} className="pbx-unsplash__sentinel" aria-hidden="true" />

      <p className="pbx-unsplash__credit">{t("imageSource.unsplash.poweredBy")}</p>
    </div>
  );
}

export { fileNameForPhoto, ApiError };
