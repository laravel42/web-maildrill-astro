/**
 * LinkField — editor de `LinkTarget` (docs/06 §4) para props de enlace
 * (`button.link`). Reemplaza el input `url` legacy (`props.href`): un enlace
 * puede ser INTERNO (a una página del sitio por `PageId` estable, con ancla
 * opcional), EXTERNO (URL libre) o un ANCLA a un nodo de la página actual.
 *
 * Escribe el objeto completo con `setProp(node.id, fieldKey, link)` — la misma
 * acción de escritura de props que el resto del Inspector (no responsive). El
 * `PageId` es estable (P1): renombrar el slug de la página no rompe el enlace;
 * la URL real se resuelve en export (`export/links.ts`).
 *
 * Controles nativos (aislados), igual que `PropField`/`StyleField` en Fase 2,
 * para poder migrar a c42 sin tocar el store (docs/05 §3).
 */

import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import type { BuilderNode, LinkTarget } from "@/builder/model/types";
import { CommittableInput } from "./CommittableInput";

function readLink(value: unknown): LinkTarget | null {
  if (typeof value !== "object" || value === null) return null;
  const kind = (value as { kind?: unknown }).kind;
  if (kind === "internal" || kind === "external" || kind === "anchor") {
    return value as LinkTarget;
  }
  return null;
}

type LinkKind = LinkTarget["kind"];

export function LinkField({ node, fieldKey }: { node: BuilderNode; fieldKey: string }) {
  const { t } = useTranslation("inspector");
  const setProp = useDocumentStore((s) => s.setProp);
  const pageOrder = useDocumentStore((s) => s.site.pageOrder);
  const pages = useDocumentStore((s) => s.site.pages);

  const link = readLink(node.props[fieldKey]);
  // Fallback retrocompat: si aún no hay `link` pero sí un `href` legacy, se
  // muestra como externo (sin reescribir hasta que el usuario edite).
  const legacyHref = typeof node.props.href === "string" ? node.props.href : "";
  const kind: LinkKind = link?.kind ?? "external";

  const write = (next: LinkTarget) => setProp(node.id, fieldKey, next);

  const changeKind = (nextKind: LinkKind) => {
    if (nextKind === kind && link) return;
    if (nextKind === "internal") {
      write({ kind: "internal", pageId: pageOrder[0] ?? "" });
    } else if (nextKind === "external") {
      write({ kind: "external", href: link?.kind === "external" ? link.href : legacyHref });
    } else {
      write({ kind: "anchor", nodeId: "" });
    }
  };

  return (
    <div className="pbx-linkfield">
      <select
        className="pbx-control__input"
        value={kind}
        onChange={(e) => changeKind(e.target.value as LinkKind)}
        aria-label={t("linkField.kind")}
      >
        <option value="internal">{t("linkField.internal")}</option>
        <option value="external">{t("linkField.external")}</option>
        <option value="anchor">{t("linkField.anchor")}</option>
      </select>

      {kind === "internal" ? (
        <>
          <select
            className="pbx-control__input"
            value={link?.kind === "internal" ? link.pageId : (pageOrder[0] ?? "")}
            onChange={(e) =>
              write({
                kind: "internal",
                pageId: e.target.value,
                ...(link?.kind === "internal" && link.anchor ? { anchor: link.anchor } : {}),
              })
            }
            aria-label={t("linkField.page")}
          >
            {pageOrder.map((id) => (
              <option key={id} value={id}>
                {pages[id]?.meta.title || pages[id]?.meta.slug || id}
              </option>
            ))}
          </select>
          <CommittableInput
            value={link?.kind === "internal" ? (link.anchor ?? "") : ""}
            placeholder={t("linkField.anchorOptional")}
            onCommit={(v) => {
              const pageId = link?.kind === "internal" ? link.pageId : (pageOrder[0] ?? "");
              write(v === "" ? { kind: "internal", pageId } : { kind: "internal", pageId, anchor: v });
            }}
          />
        </>
      ) : kind === "external" ? (
        <CommittableInput
          value={link?.kind === "external" ? link.href : legacyHref}
          type="url"
          placeholder="https://…"
          onCommit={(v) => write({ kind: "external", href: v })}
        />
      ) : (
        <CommittableInput
          value={link?.kind === "anchor" ? link.nodeId : ""}
          placeholder={t("linkField.nodeId")}
          onCommit={(v) => write({ kind: "anchor", nodeId: v })}
        />
      )}
    </div>
  );
}
