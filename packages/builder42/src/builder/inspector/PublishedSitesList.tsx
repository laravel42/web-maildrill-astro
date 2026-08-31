/**
 * PublishedSitesList — gestión de sitios publicados (docs/36 F5, cierra B4).
 * Lista con URL/provider/subdomain/publishedAt y acciones Abrir · Despublicar.
 * Despublicar pide confirmación explícita en un modal (destructivo e
 * irreversible) — sin `window.confirm` (chrome del editor vía c42, P10; un
 * confirm nativo del navegador rompería ese contrato). Se usa `SimpleModal`
 * (mismo fix/patrón que `PublishModal`/`TranslationModal`, ver cabecera de
 * `src/components/SimpleModal.tsx`) en vez de un bloque inline en la fila del
 * item: el inline (`<span>` con el mensaje + 2 botones dentro de la misma fila
 * flex del item) empujaba y rompía el layout de la lista/sidebar al abrirse.
 *
 * No ofrece "Republicar" un sitio arbitrario de la lista: la unidad de
 * publicación de esta iteración es "el sitio actualmente abierto en el
 * editor" (docs/36, alcance), y ese flujo ya lo cubre `PublishPanel` (muestra
 * "Republicar" cuando `site.meta.siteId` ya existe). Esta lista se monta junto
 * a `PublishPanel` en la misma tab.
 *
 * `refreshSignal` (opcional): `PublishPanel` y esta lista son hermanos sin
 * estado compartido — sin esto, la lista hace su fetch una sola vez al montar
 * y nunca se enteraba de una publicación/republicación posterior en la misma
 * sesión (bug real: "Site published!" en `PublishPanel` pero la lista seguía
 * mostrando "no has publicado ningún sitio"). El padre (`SiteSettingsPanel`)
 * incrementa un contador cada vez que `PublishPanel` termina un publish con
 * éxito; esta lista re-hace `load()` cuando ese valor cambia.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchHealth, listPublishedSites, unpublishSite } from "@/services/apiClient";
import { ExternalLink, Trash2, SimpleModal, IconButton, CloseIcon } from "@/components";
import type { HealthResponse, PublishedSite } from "../../../shared/api";

type ListState =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "loaded"; sites: PublishedSite[] }
  | { kind: "error" };

function UnpublishConfirmModal({
  site,
  pending,
  onConfirm,
  onCancel,
}: {
  site: PublishedSite;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("inspector");
  return (
    <SimpleModal className="pbx-modal" onClose={onCancel}>
      <div data-c42-modal-overlay className="pbx-modal__overlay" />
      <div
        data-c42-modal-content
        className="pbx-modal__content pbx-unpublish-modal"
        role="alertdialog"
        aria-label={t("publish.managedSites.unpublishConfirmTitle")}
      >
        <div className="pbx-modal__header">
          <h3 className="pbx-modal__title">{t("publish.managedSites.unpublishConfirmTitle")}</h3>
          <IconButton
            icon={CloseIcon}
            intent="ghost"
            size="md"
            label={t("publish.managedSites.unpublishModalClose")}
            data-c42-modal-close
          />
        </div>
        <div className="pbx-modal__body">
          <p className="pbx-publish-panel__error" role="alert">
            {t("publish.managedSites.unpublishConfirmBody")}
          </p>
          <span className="pbx-published-sites__url">{site.url}</span>
          <div className="pbx-unpublish-modal__actions">
            <button
              type="button"
              className="pbx-publish-panel__btn"
              disabled={pending}
              onClick={onCancel}
            >
              {t("publish.managedSites.unpublishCancel")}
            </button>
            <button
              type="button"
              className="pbx-publish-panel__btn pbx-published-sites__btn--danger"
              disabled={pending}
              onClick={onConfirm}
            >
              {pending
                ? t("publish.managedSites.unpublishing")
                : t("publish.managedSites.unpublishConfirmAction")}
            </button>
          </div>
        </div>
      </div>
    </SimpleModal>
  );
}

export function PublishedSitesList({ refreshSignal }: { refreshSignal?: number } = {}) {
  const { t } = useTranslation("inspector");
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [capabilities, setCapabilities] = useState<HealthResponse["publish"]["capabilities"] | undefined>(
    undefined,
  );
  const [confirmingSiteId, setConfirmingSiteId] = useState<string | null>(null);
  const [unpublishingSiteId, setUnpublishingSiteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const health = await fetchHealth();
      setCapabilities(health.publish.capabilities);
      if (!health.publish.capabilities.list) {
        setState({ kind: "unavailable" });
        return;
      }
      const { sites } = await listPublishedSites();
      setState({ kind: "loaded", sites });
    } catch {
      setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    void load();
    // `refreshSignal` se incluye a propósito: cada cambio (publish/republish
    // exitoso en el hermano `PublishPanel`) debe re-disparar el fetch aunque
    // `load` en sí no haya cambiado de identidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, refreshSignal]);

  const handleUnpublish = useCallback(
    async (siteId: string) => {
      setUnpublishingSiteId(siteId);
      try {
        await unpublishSite(siteId);
        setConfirmingSiteId(null);
        await load();
      } catch (err) {
        // Deja el modal de confirmación abierto: el usuario puede reintentar.
        // El error concreto no es crítico de mostrar aquí (a diferencia de
        // PublishPanel, que sí lo hace) — despublicar es una operación de
        // gestión secundaria.
        void err;
      } finally {
        setUnpublishingSiteId(null);
      }
    },
    [load],
  );

  if (state.kind === "loading") {
    return <p className="pbx-publish-panel__hint">{t("publish.managedSites.title")}…</p>;
  }

  if (state.kind === "unavailable") {
    return (
      <div className="pbx-published-sites">
        <h4 className="pbx-inspector__heading">{t("publish.managedSites.title")}</h4>
        <p className="pbx-publish-panel__hint">{t("publish.managedSites.unavailable")}</p>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="pbx-published-sites">
        <h4 className="pbx-inspector__heading">{t("publish.managedSites.title")}</h4>
        <p className="pbx-publish-panel__error" role="alert">
          {t("publish.managedSites.loadError")}
        </p>
      </div>
    );
  }

  const confirmingSite = state.sites.find((s) => s.siteId === confirmingSiteId) ?? null;

  return (
    <div className="pbx-published-sites">
      <h4 className="pbx-inspector__heading">{t("publish.managedSites.title")}</h4>
      {state.sites.length === 0 ? (
        <p className="pbx-publish-panel__hint">{t("publish.managedSites.empty")}</p>
      ) : (
        <ul className="pbx-published-sites__list">
          {state.sites.map((site) => (
            <li key={site.siteId} className="pbx-published-sites__item">
              <div className="pbx-published-sites__info">
                <span className="pbx-published-sites__url">{site.url}</span>
                <span className="pbx-published-sites__meta">
                  {t("publish.managedSites.providerLabel", { provider: site.provider })}
                  {" · "}
                  {t("publish.managedSites.publishedAt", { date: new Date(site.publishedAt).toLocaleString() })}
                </span>
              </div>

              <div className="pbx-published-sites__actions">
                {capabilities?.openableUrl ? (
                  <a
                    className="pbx-publish-panel__btn"
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t("publish.managedSites.open")}
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                ) : null}

                {capabilities?.remove && confirmingSiteId !== site.siteId ? (
                  <button
                    type="button"
                    className="pbx-publish-panel__btn pbx-published-sites__btn--danger"
                    onClick={() => setConfirmingSiteId(site.siteId)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {t("publish.managedSites.unpublish")}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirmingSite ? (
        <UnpublishConfirmModal
          site={confirmingSite}
          pending={unpublishingSiteId === confirmingSite.siteId}
          onConfirm={() => handleUnpublish(confirmingSite.siteId)}
          onCancel={() => setConfirmingSiteId(null)}
        />
      ) : null}
    </div>
  );
}
