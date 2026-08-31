/**
 * PublishPanel — flujo de publicación del sitio completo (docs/36 F4).
 * Componente único consumido en dos contenedores: el `PublishModal` del
 * header y la tab "publish" del `SiteSettingsPanel` — no se duplica lógica,
 * los contenedores son solo presentación (docs/36 §3).
 *
 * Gating: si `PUBLISH_ENABLED=false` en el servidor, explica por qué en vez
 * de desaparecer sin más (el operador debe habilitarlo, no es un bug del
 * usuario). Publica sobre `getFlushedSite()` (igual que `SiteFileActions`),
 * nunca sobre el borrador (`document` de la página activa sin flush).
 *
 * `onPublished` (opcional): notifica al padre (`SiteSettingsPanel`) tras un
 * publish/republish exitoso, para que refresque la lista de sitios
 * publicados (`PublishedSitesList`, hermano sin estado compartido — ver su
 * doc de cabecera).
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { serializeSite } from "@/builder/model/persist";
import { publishSite, fetchHealth, checkPublishSize, ApiError } from "@/services/apiClient";
import { slugifySiteId, isValidSubdomain } from "../../../shared/slug";
import { ExportWarningsBanner } from "@/components/ExportWarningsBanner";
import type { HealthResponse } from "../../../shared/api";
import type { ApiErrorCode, ExportWarning } from "../../../shared/api";

type PublishState =
  | { kind: "idle" }
  | { kind: "publishing" }
  | { kind: "done"; url: string; provider: string; openableUrl: boolean; warnings: ExportWarning[] }
  | { kind: "error"; code: ApiErrorCode; retryAfter?: number };

export function PublishPanel({ onPublished }: { onPublished?: () => void } = {}) {
  const { t } = useTranslation("inspector");
  const site = useDocumentStore((s) => s.site);
  const getFlushedSite = useDocumentStore((s) => s.getFlushedSite);
  const setSiteId = useDocumentStore((s) => s.setSiteId);

  const [health, setHealth] = useState<HealthResponse["publish"] | undefined>(undefined);
  const [subdomain, setSubdomain] = useState(site.meta.siteId ?? slugifySiteId(site.meta.name) ?? "");
  const [state, setState] = useState<PublishState>({ kind: "idle" });

  useEffect(() => {
    fetchHealth()
      .then((h) => setHealth(h.publish))
      .catch(() => setHealth(undefined));
  }, []);

  const handlePublish = useCallback(async () => {
    setState({ kind: "publishing" });
    try {
      const flushed = getFlushedSite();
      const serialized = serializeSite(flushed);

      const siteId = flushed.meta.siteId ?? slugifySiteId(flushed.meta.name) ?? subdomain;
      const domain = health?.capabilities.customSubdomain && subdomain ? subdomain : undefined;

      const result = await publishSite({
        site: JSON.parse(serialized),
        siteId,
        domain,
      });

      setSiteId(siteId);
      setState({
        kind: "done",
        url: result.url,
        provider: result.provider,
        openableUrl: health?.capabilities.openableUrl ?? true,
        warnings: result.warnings ?? [],
      });
      onPublished?.();
    } catch (err) {
      if (err instanceof ApiError) {
        setState({
          kind: "error",
          code: err.code as ApiErrorCode,
          retryAfter: err.retryAfter,
        });
      } else {
        setState({ kind: "error", code: "internal_error" });
      }
    }
  }, [getFlushedSite, health, subdomain, setSiteId, onPublished]);

  // --- Gating: publish.enabled === false --------------------------------
  if (health !== undefined && !health.enabled) {
    return (
      <div className="pbx-publish-panel">
        <h4 className="pbx-inspector__heading">{t("publish.disabledTitle")}</h4>
        <p className="pbx-publish-panel__hint">{t("publish.disabledHint")}</p>
      </div>
    );
  }

  const capabilities = health?.capabilities;
  const preview = getFlushedSite();
  const preflight = checkPublishSize(serializeSite(preview));
  const subdomainValid = subdomain.length === 0 || isValidSubdomain(subdomain);

  return (
    <div className="pbx-publish-panel">
      <h4 className="pbx-inspector__heading">{t("publish.title")}</h4>

      {state.kind !== "done" && (
        <>
          {capabilities?.customSubdomain ? (
            <div className="pbx-publish-panel__field">
              <label className="pbx-control__label" htmlFor="pbx-publish-subdomain">
                {t("publish.subdomainLabel")}
              </label>
              <input
                id="pbx-publish-subdomain"
                className="pbx-control__input"
                value={subdomain}
                placeholder={t("publish.subdomainPlaceholder")}
                onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                disabled={state.kind === "publishing"}
              />
              {subdomain && subdomainValid && health?.baseDomain ? (
                <p className="pbx-publish-panel__preview">
                  {t("publish.subdomainPreview", { url: `https://${subdomain}.${health.baseDomain}` })}
                </p>
              ) : null}
              {!subdomainValid ? (
                <p className="pbx-publish-panel__error" role="alert">
                  {t("publish.subdomainInvalid")}
                </p>
              ) : (
                <p className="pbx-publish-panel__hint">{t("publish.subdomainHint")}</p>
              )}
            </div>
          ) : null}

          {state.kind === "idle" && <p className="pbx-publish-panel__hint">{t("publish.idle.hint")}</p>}

          {preflight.tooLarge && (
            <p className="pbx-publish-panel__warning" role="alert">
              {t("publish.sizeWarning", { size: `${(preflight.bytes / 1024 / 1024).toFixed(1)}MB` })}
            </p>
          )}

          {state.kind === "error" && (
            <p className="pbx-publish-panel__error" role="alert">
              {t(`publish.errors.${state.code}`, {
                defaultValue: t("publish.errors.unknown"),
                seconds: state.retryAfter,
              })}
            </p>
          )}

          <button
            type="button"
            className="pbx-publish-panel__btn pbx-publish-panel__btn--primary"
            disabled={state.kind === "publishing" || !subdomainValid}
            onClick={handlePublish}
          >
            {state.kind === "publishing"
              ? t("publish.publishing")
              : site.meta.siteId
                ? t("publish.republishButton")
                : t("publish.publishButton")}
          </button>
        </>
      )}

      {state.kind === "done" && (
        <div className="pbx-publish-panel__done">
          <p className="pbx-publish-panel__done-title">{t("publish.done.title")}</p>
          <p className="pbx-publish-panel__done-url">
            <span className="pbx-control__label">{t("publish.done.urlLabel")}</span>{" "}
            <code>{state.url}</code>
          </p>
          {state.warnings.length > 0 ? (
            <ExportWarningsBanner warnings={state.warnings} ns="inspector" />
          ) : null}
          <div className="pbx-publish-panel__actions">
            {state.openableUrl ? (
              <a
                className="pbx-publish-panel__btn"
                href={state.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("publish.done.open")}
              </a>
            ) : (
              <span className="pbx-publish-panel__hint">{t("publish.done.openDisabled")}</span>
            )}
            <button
              type="button"
              className="pbx-publish-panel__btn"
              onClick={() => setState({ kind: "idle" })}
            >
              {t("publish.done.publishAgain")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
