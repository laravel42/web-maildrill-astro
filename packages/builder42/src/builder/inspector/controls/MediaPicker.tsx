/**
 * MediaPicker — panel inline de la media library del tenant (docs/AGENTS.md
 * §4b), hermano de `UnsplashPicker` dentro de `ImageSourceField`. Segunda
 * fuente de imágenes, complementaria a Unsplash — no sustitutiva.
 *
 * Diferencia clave con Unsplash: elegir un asset llama a `onSelect` con la
 * URL directa (el host ya la sirve desde su propio storage), NUNCA con un
 * data URL vía `addAsset` — eso es lo que evita que una landing se infle con
 * imágenes incrustadas (ver `docs/landing-pages-builder-integration.md` §4b).
 *
 * Flujo: input con debounce 400ms → `listMedia` → grid de thumbnails con
 * scroll infinito (IntersectionObserver) → click en un asset → `onSelect`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listMedia } from "@/services/apiClient";
import { CloseIcon, IconButton, Search } from "@/components";
import type { MediaAsset } from "../../../../shared/api";

const SEARCH_DEBOUNCE_MS = 400;

interface MediaPickerProps {
  /** Llamado con el asset elegido; el picker no conoce `nodeId`/`fieldKey`. */
  onSelect: (asset: MediaAsset) => void;
  onClose: () => void;
}

type FetchState = "idle" | "loading" | "loading-more" | "error";

export function MediaPicker({ onSelect, onClose }: MediaPickerProps) {
  const { t } = useTranslation("inspector");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaAsset[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [state, setState] = useState<FetchState>("idle");

  const activeQueryRef = useRef("");
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Misma defensa que `UnsplashPicker` contra disparos duplicados del
  // IntersectionObserver mientras un fetch de paginación está en curso.
  const fetchingRef = useRef(false);

  const runSearch = useCallback(async (q: string, nextPage: number, append: boolean) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setState(append ? "loading-more" : "loading");
    try {
      const res = await listMedia(q.trim(), nextPage, 30);
      if (activeQueryRef.current !== q) return;
      setResults((prev) => {
        if (!append) return res.results;
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

  // A diferencia de Unsplash, la media library lista todo por defecto
  // (query vacío = sin filtrar), así que la primera carga corre de una vez.
  useEffect(() => {
    activeQueryRef.current = query;
    const handle = setTimeout(() => {
      void runSearch(query, 1, false);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, runSearch]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
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
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [page, totalPages, results.length, state, query, runSearch]);

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
            placeholder={t("imageSource.mediaLibrary.searchPlaceholder")}
            aria-label={t("imageSource.mediaLibrary.searchAriaLabel")}
            autoFocus
          />
        </div>
        <IconButton
          icon={CloseIcon}
          label={t("imageSource.mediaLibrary.close")}
          onClick={onClose}
        />
      </div>

      {state === "error" && (
        <p className="pbx-unsplash__error" role="alert">
          {t("imageSource.mediaLibrary.error")}
        </p>
      )}

      {state === "loading" && results.length === 0 && (
        <p className="pbx-unsplash__hint">{t("imageSource.mediaLibrary.loading")}</p>
      )}

      {state !== "loading" && state !== "error" && results.length === 0 && (
        <p className="pbx-unsplash__hint">
          {query.trim() === ""
            ? t("imageSource.mediaLibrary.empty")
            : t("imageSource.mediaLibrary.emptySearch")}
        </p>
      )}

      {results.length > 0 && (
        <div
          className="pbx-unsplash__grid"
          role="list"
          aria-label={t("imageSource.mediaLibrary.resultsGridAriaLabel")}
        >
          {results.map((asset) => (
            <div key={asset.id} className="pbx-unsplash__cell" role="listitem">
              <button
                type="button"
                className="pbx-unsplash__photo-btn"
                onClick={() => onSelect(asset)}
                aria-label={t("imageSource.mediaLibrary.selectAssetAriaLabel", {
                  name: asset.fileName,
                })}
                style={
                  asset.width && asset.height
                    ? { aspectRatio: `${asset.width} / ${asset.height}` }
                    : undefined
                }
              >
                <img
                  className="pbx-unsplash__thumb"
                  src={asset.thumbUrl || asset.url}
                  alt=""
                  loading="lazy"
                />
              </button>
              <span className="pbx-unsplash__author">{asset.fileName}</span>
            </div>
          ))}
          {/* Dentro del grid con scroll propio (`overflow-y: auto`), no como
              hermano tras él — un IntersectionObserver sin `root` explícito
              resuelve su ancestro con scroll automáticamente SOLO si el
              elemento observado está dentro de ese ancestro. Fuera de él
              (como estaba antes), nunca intersecta según el scroll del grid
              y la paginación infinita nunca dispara. */}
          <div ref={sentinelRef} className="pbx-unsplash__sentinel" aria-hidden="true" />
        </div>
      )}

      {state === "loading-more" && (
        <p className="pbx-unsplash__hint">{t("imageSource.mediaLibrary.loadingMore")}</p>
      )}
    </div>
  );
}
