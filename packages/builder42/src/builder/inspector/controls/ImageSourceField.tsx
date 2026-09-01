/**
 * ImageSourceField — control de la fuente de una imagen (docs/07 §4, docs/35 §2 Fase B).
 *
 * Tres modos: **URL externa**, **subir archivo** o **buscar en Unsplash** (si
 * el servidor lo tiene habilitado). Al subir/elegir, se registra el asset del
 * sitio (`addAsset`) y se apunta el nodo a `{ kind: "asset", assetId }`. El
 * canvas muestra el data URL; el export materializa el binario en
 * `assets/img/…`. Si el asset viene de Unsplash, se muestra su atribución.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { readImageSource } from "@/builder/model/assets";
import { fetchHealth } from "@/services/apiClient";
import { UnsplashPicker } from "./UnsplashPicker";
import { MediaPicker } from "./MediaPicker";
import type { BuilderNode } from "@/builder/model/types";
import type { ImageSearchResult, MediaAsset } from "../../../../shared/api";

export function ImageSourceField({ node, fieldKey }: { node: BuilderNode; fieldKey: string }) {
  const { t } = useTranslation("inspector");
  const setProp = useDocumentStore((s) => s.setProp);
  const addAsset = useDocumentStore((s) => s.addAsset);
  const assets = useDocumentStore((s) => s.site.assets);
  const fileRef = useRef<HTMLInputElement>(null);
  const [unsplashAvailable, setUnsplashAvailable] = useState(false);
  const [mediaAvailable, setMediaAvailable] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<"unsplash" | "media" | null>(null);

  useEffect(() => {
    fetchHealth()
      .then((h) => {
        setUnsplashAvailable(h.unsplash.enabled);
        setMediaAvailable(h.media.enabled);
      })
      .catch(() => {
        setUnsplashAvailable(false);
        setMediaAvailable(false);
      });
  }, []);

  const source = readImageSource(node.props);
  const asset = source?.kind === "asset" ? assets?.[source.assetId] : undefined;

  const setUrl = (url: string) => setProp(node.id, fieldKey, { kind: "url", url });

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;
      const id = addAsset(file.name, file.type || "application/octet-stream", dataUrl);
      setProp(node.id, fieldKey, { kind: "asset", assetId: id });
    };
    reader.readAsDataURL(file);
  };

  const onUnsplashSelect = (result: ImageSearchResult, dataUrl: string) => {
    const id = addAsset(`unsplash-${result.id}.jpg`, "image/jpeg", dataUrl, {
      source: "unsplash",
      photographer: result.author.name,
      photographerUrl: result.author.url,
      photoUrl: result.unsplashUrl,
    });
    setProp(node.id, fieldKey, { kind: "asset", assetId: id });
    setPickerOpen(null);
  };

  /**
   * A diferencia de subir un archivo o elegir de Unsplash, la media library
   * NO se incrusta como asset: el host ya sirve el binario desde su propio
   * storage, así que apuntar el nodo a la URL evita inflar el documento con
   * un data URL redundante (docs/AGENTS.md §4b).
   */
  const onMediaSelect = (asset: MediaAsset) => {
    setUrl(asset.url);
    setPickerOpen(null);
  };

  return (
    <div className="pbx-imgsrc">
      {asset ? (
        <div className="pbx-imgsrc__asset">
          <img className="pbx-imgsrc__preview" src={asset.dataUrl} alt="" />
          <span className="pbx-imgsrc__name">{asset.fileName}</span>
        </div>
      ) : (
        <input
          className="pbx-control__input"
          type="url"
          placeholder={t("imageSource.urlPlaceholder")}
          defaultValue={source?.kind === "url" ? source.url : ""}
          onBlur={(e) => setUrl(e.target.value)}
        />
      )}

      {asset?.attribution?.source === "unsplash" && (
        <p className="pbx-imgsrc__attribution">
          📷{" "}
          <a href={asset.attribution.photographerUrl} target="_blank" rel="noreferrer noopener">
            {asset.attribution.photographer}
          </a>
          {" · "}
          <a href={asset.attribution.photoUrl} target="_blank" rel="noreferrer noopener">
            Unsplash
          </a>
        </p>
      )}

      <div className="pbx-imgsrc__actions">
        <button
          type="button"
          className="pbx-code__btn pbx-code__btn--sm"
          onClick={() => fileRef.current?.click()}
        >
          {t("imageSource.uploadImage")}
        </button>
        {mediaAvailable && (
          <button
            type="button"
            className="pbx-code__btn pbx-code__btn--sm"
            onClick={() => setPickerOpen((open) => (open === "media" ? null : "media"))}
            aria-expanded={pickerOpen === "media"}
          >
            {t("imageSource.mediaLibrary.tabLabel")}
          </button>
        )}
        {unsplashAvailable && (
          <button
            type="button"
            className="pbx-code__btn pbx-code__btn--sm"
            onClick={() => setPickerOpen((open) => (open === "unsplash" ? null : "unsplash"))}
            aria-expanded={pickerOpen === "unsplash"}
          >
            {t("imageSource.unsplash.tabLabel")}
          </button>
        )}
        {asset ? (
          <button
            type="button"
            className="pbx-code__btn pbx-code__btn--sm"
            onClick={() => setUrl("")}
          >
            {t("imageSource.useUrl")}
          </button>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {pickerOpen === "media" && (
        <MediaPicker onSelect={onMediaSelect} onClose={() => setPickerOpen(null)} />
      )}
      {pickerOpen === "unsplash" && (
        <UnsplashPicker onSelect={onUnsplashSelect} onClose={() => setPickerOpen(null)} />
      )}
    </div>
  );
}
