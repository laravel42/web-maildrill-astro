/**
 * ThemesEditor — editor de temas a nivel sitio (docs/11 §6, Fase 9.3). Chrome
 * del editor (no toca el output, P8): CRUD de temas + remapeo de tokens
 * semánticos por tema, con preview en vivo (el `activeThemeId` pinta el canvas
 * vía `data-theme`, docs/11 §4) y aviso de contraste WCAG AA (docs/11 §6).
 *
 * Los temas viven en `site.meta.themes` (parte del sitio, no del historial de
 * zundo — igual que los tokens). El "tema activo" es UI-state de preview.
 */

import { useTranslation } from "react-i18next";
import { IconButton, ResetIcon, CloseIcon, WarnIcon, Check, Star, ColorPicker, PbxSelect } from "@/components";
import { useDocumentStore } from "@/builder/store/documentStore";
import { effectiveResolvedTokens } from "@/builder/model/theme";
import { flattenTree } from "@/builder/model/tokens";
import { THEME_PRESETS, type ThemePreset } from "@/builder/model/themePresets";
import { getLayoutThemePresets, type LayoutThemePreset } from "@/builder/registry/layoutThemePresets";
import { checkContrast } from "@/builder/model/contrast";
import type { Theme, TokenGroupTree } from "@/builder/model/types";
import { CommittableInput } from "./controls/CommittableInput";
import { NumericUnitInput } from "./controls/NumericUnitInput";
import { CompatWarning } from "./controls/CompatWarning";

/** Fila de edición de un color semántico dentro de un tema. */
function ThemeColorRow({
  themeId,
  colorKey,
  override,
  resolved,
}: {
  themeId: string;
  colorKey: string;
  /** Valor del override en el tema (string) o undefined si hereda. */
  override: string | undefined;
  /** Valor efectivo resuelto (para el swatch cuando no hay override). */
  resolved: string | undefined;
}) {
  const { t } = useTranslation("inspector");
  const setThemeToken = useDocumentStore((s) => s.setThemeToken);
  const removeThemeToken = useDocumentStore((s) => s.removeThemeToken);
  const path = `colors.${colorKey}`;
  const swatch = override ?? resolved ?? "#000000";

  return (
    <div className={"pbx-theme-token" + (override !== undefined ? " pbx-theme-token--overridden" : "")}>
      <ColorPicker
        value={swatch}
        onChange={(hex) => setThemeToken(themeId, path, hex)}
        onChangeEnd={(hex) => setThemeToken(themeId, path, hex)}
        label={`${path} color`}
        swatchClassName="pbx-token__swatch"
      />
      <span className="pbx-theme-token__key" title={path}>
        {colorKey}
      </span>
      <CommittableInput
        value={override ?? ""}
        placeholder={resolved ?? ""}
        onCommit={(v) => (v.trim() === "" ? removeThemeToken(themeId, path) : setThemeToken(themeId, path, v))}
      />
      <IconButton
        icon={ResetIcon}
        label={t("themes.resetToken")}
        intent="danger"
        disabled={override === undefined}
        onClick={() => removeThemeToken(themeId, path)}
      />
    </div>
  );
}

/** Sección "Barra de desplazamiento" del tema (T6): personaliza las variables
 * `--scrollbar-*` del sitio exportado (thumb/track/grosor). El título lleva un
 * aviso de compatibilidad (Firefox no permite afinar grosor/esquinas/hover). */
function ThemeScrollbarSection({
  themeId,
  thumb,
  track,
  size,
}: {
  themeId: string;
  thumb: string | undefined;
  track: string | undefined;
  size: string | undefined;
}) {
  const { t } = useTranslation("inspector");
  const setThemeToken = useDocumentStore((s) => s.setThemeToken);
  const removeThemeToken = useDocumentStore((s) => s.removeThemeToken);

  const commit = (path: string, v: string) =>
    v.trim() === "" ? removeThemeToken(themeId, path) : setThemeToken(themeId, path, v);

  return (
    <div className="pbx-themes__tokens">
      <span className="pbx-themes__tokens-label">
        {t("themes.scrollbar.title")}
        <CompatWarning message={t("themes.scrollbar.compat")} />
      </span>

      <div className={"pbx-theme-token" + (thumb !== undefined ? " pbx-theme-token--overridden" : "")}>
        <ColorPicker
          value={thumb ?? "#888888"}
          onChange={(hex) => setThemeToken(themeId, "scrollbar.thumb", hex)}
          onChangeEnd={(hex) => setThemeToken(themeId, "scrollbar.thumb", hex)}
          label={t("themes.scrollbar.thumb")}
          swatchClassName="pbx-token__swatch"
        />
        <span className="pbx-theme-token__key">{t("themes.scrollbar.thumb")}</span>
        <CommittableInput value={thumb ?? ""} placeholder="#888888" onCommit={(v) => commit("scrollbar.thumb", v)} />
        <IconButton
          icon={ResetIcon}
          label={t("themes.resetToken")}
          intent="danger"
          disabled={thumb === undefined}
          onClick={() => removeThemeToken(themeId, "scrollbar.thumb")}
        />
      </div>

      <div className={"pbx-theme-token" + (track !== undefined ? " pbx-theme-token--overridden" : "")}>
        <ColorPicker
          value={track ?? "#eeeeee"}
          onChange={(hex) => setThemeToken(themeId, "scrollbar.track", hex)}
          onChangeEnd={(hex) => setThemeToken(themeId, "scrollbar.track", hex)}
          label={t("themes.scrollbar.track")}
          swatchClassName="pbx-token__swatch"
        />
        <span className="pbx-theme-token__key">{t("themes.scrollbar.track")}</span>
        <CommittableInput value={track ?? ""} placeholder="transparent" onCommit={(v) => commit("scrollbar.track", v)} />
        <IconButton
          icon={ResetIcon}
          label={t("themes.resetToken")}
          intent="danger"
          disabled={track === undefined}
          onClick={() => removeThemeToken(themeId, "scrollbar.track")}
        />
      </div>

      <div className={"pbx-theme-token" + (size !== undefined ? " pbx-theme-token--overridden" : "")}>
        <span className="pbx-theme-token__key pbx-theme-token__key--wide">{t("themes.scrollbar.size")}</span>
        <NumericUnitInput
          value={size ?? ""}
          units={["px", "em", "rem"]}
          defaultUnit="px"
          placeholder="10px"
          onCommit={(v) => commit("scrollbar.size", v)}
        />
        <IconButton
          icon={ResetIcon}
          label={t("themes.resetToken")}
          intent="danger"
          disabled={size === undefined}
          onClick={() => removeThemeToken(themeId, "scrollbar.size")}
        />
      </div>
    </div>
  );
}

/**
 * ¿Ya existe en `site.meta.themes` un tema con estos MISMOS tokens/colorScheme?
 * (docs/48 §3 — indicador "aplicado actualmente" en la galería.) Los presets de
 * `THEME_PRESETS` no tienen id determinista (`applyThemePreset` genera
 * `theme-N` vía `uniqueThemeId`), así que el único criterio fiable es
 * comparar el contenido, no el id — funciona igual para los 6 genéricos y
 * para los de plantilla (que sí tienen id determinista, pero da lo mismo).
 */
function presetIsApplied(
  preset: { tokens: Record<string, string>; colorScheme?: "light" | "dark" },
  themes: Record<string, Theme> | undefined,
): boolean {
  if (!themes) return false;
  const presetKeys = Object.keys(preset.tokens);
  return Object.values(themes).some((theme) => {
    if ((theme.colorScheme ?? undefined) !== (preset.colorScheme ?? undefined)) return false;
    const themeKeys = Object.keys(theme.tokens);
    if (themeKeys.length !== presetKeys.length) return false;
    return presetKeys.every((key) => theme.tokens[key] === preset.tokens[key]);
  });
}

export function ThemesEditor() {
  const { t } = useTranslation("inspector");
  const themes = useDocumentStore((s) => s.site.meta.themes);
  const defaultThemeId = useDocumentStore((s) => s.site.meta.defaultThemeId);
  const baseTokens = useDocumentStore((s) => s.site.meta.tokens);
  const activeThemeId = useDocumentStore((s) => s.activeThemeId);
  const setActiveTheme = useDocumentStore((s) => s.setActiveTheme);
  const addTheme = useDocumentStore((s) => s.addTheme);
  const removeTheme = useDocumentStore((s) => s.removeTheme);
  const updateThemeMeta = useDocumentStore((s) => s.updateThemeMeta);
  const setDefaultTheme = useDocumentStore((s) => s.setDefaultTheme);
  const applyThemePreset = useDocumentStore((s) => s.applyThemePreset);
  const applyLayoutThemePreset = useDocumentStore((s) => s.applyLayoutThemePreset);

  const themeIds = themes ? Object.keys(themes) : [];
  const editingId = activeThemeId && themes?.[activeThemeId] ? activeThemeId : themeIds[0];
  const editingTheme = editingId ? themes?.[editingId] : undefined;

  const colorKeys = baseTokens?.colors
    ? Object.keys(flattenTree(baseTokens.colors as TokenGroupTree))
    : [];
  const resolved = editingId ? effectiveResolvedTokens(baseTokens, themes, editingId) : {};

  // Aviso de contraste texto/superficie del tema en edición (docs/11 §6).
  const contrast =
    resolved["colors.text"] && resolved["colors.surface.default"]
      ? checkContrast(resolved["colors.text"], resolved["colors.surface.default"])
      : null;

  return (
    <section className="pbx-site-settings__section pbx-themes">
      <h4 className="pbx-inspector__heading">{t("themes.title")}</h4>

      <div className="pbx-theme-gallery">
        <span className="pbx-theme-gallery__label">{t("themes.gallery")}</span>
        <div className="pbx-theme-gallery__grid">
          {THEME_PRESETS.map((preset: ThemePreset) => {
            const applied = presetIsApplied(preset, themes);
            return (
              <button
                key={preset.id}
                type="button"
                className={"pbx-theme-gallery__card" + (applied ? " pbx-theme-gallery__card--applied" : "")}
                title={t("themes.applyPreset", { name: preset.name })}
                aria-pressed={applied}
                onClick={() => applyThemePreset(preset.id)}
              >
                {applied ? (
                  <span className="pbx-theme-gallery__check" aria-hidden="true">
                    <Check size={12} strokeWidth={3} />
                  </span>
                ) : null}
                <span className="pbx-theme-gallery__swatches" aria-hidden="true">
                  {["colors.surface.default", "colors.primary.default", "colors.text", "colors.border"].map((key) => (
                    <span
                      key={key}
                      className="pbx-theme-gallery__swatch"
                      style={{ background: preset.tokens[key] ?? "transparent" }}
                    />
                  ))}
                </span>
                <span className="pbx-theme-gallery__name">{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pbx-theme-gallery">
        <span className="pbx-theme-gallery__label">{t("themes.templateGallery")}</span>
        <p className="pbx-themes__hint">{t("themes.templateGalleryHint")}</p>
        <div className="pbx-theme-gallery__grid">
          {getLayoutThemePresets().map((preset: LayoutThemePreset) => {
            const applied = presetIsApplied(preset, themes);
            return (
              <button
                key={preset.id}
                type="button"
                className={"pbx-theme-gallery__card" + (applied ? " pbx-theme-gallery__card--applied" : "")}
                title={t("themes.applyPreset", { name: preset.name })}
                aria-pressed={applied}
                onClick={() => applyLayoutThemePreset(preset.id)}
              >
                {applied ? (
                  <span className="pbx-theme-gallery__check" aria-hidden="true">
                    <Check size={12} strokeWidth={3} />
                  </span>
                ) : null}
                <span className="pbx-theme-gallery__swatches" aria-hidden="true">
                  {["colors.surface.default", "colors.primary.default", "colors.text", "colors.border"].map((key) => (
                    <span
                      key={key}
                      className="pbx-theme-gallery__swatch"
                      style={{ background: preset.tokens[key] ?? "transparent" }}
                    />
                  ))}
                </span>
                <span className="pbx-theme-gallery__name">{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {themeIds.length === 0 ? (
        <p className="pbx-themes__hint">{t("themes.empty")}</p>
      ) : (
        <div className="pbx-themes__preview">
          <label className="pbx-themes__preview-label" htmlFor="pbx-active-theme">
            {t("themes.preview")}
          </label>
          <PbxSelect
            id="pbx-active-theme"
            value={activeThemeId ?? ""}
            onChange={(v) => setActiveTheme(v || null)}
            options={[
              { value: "", label: t("themes.noTheme") },
              ...themeIds.map((id) => ({
                value: id,
                label: `${themes![id]!.name}${id === defaultThemeId ? " ★" : ""}`,
              })),
            ]}
          />
        </div>
      )}

      <ul className="pbx-themes__list">
        {themeIds.map((id) => {
          const theme = themes![id]!;
          const isDefault = id === defaultThemeId;
          const isEditing = id === editingId;
          return (
            <li
              key={id}
              className={"pbx-themes__item" + (isEditing ? " pbx-themes__item--active" : "")}
            >
              <div className="pbx-themes__row">
                <button
                  type="button"
                  className="pbx-themes__select"
                  aria-current={isEditing}
                  onClick={() => setActiveTheme(id)}
                >
                  {theme.name}
                  {isDefault ? (
                    <span className="pbx-themes__default-badge" aria-hidden="true">
                      <Star size={12} strokeWidth={2} />
                    </span>
                  ) : null}
                </button>
                <IconButton
                  icon={Star}
                  label={t("themes.setDefault")}
                  intent="accent"
                  active={isDefault}
                  disabled={isDefault}
                  onClick={() => setDefaultTheme(id)}
                />
                <IconButton
                  icon={CloseIcon}
                  label={t("themes.delete")}
                  intent="danger"
                  onClick={() => removeTheme(id)}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <button type="button" className="pbx-themes__new" onClick={() => addTheme()}>
        + {t("themes.add")}
      </button>

      {editingTheme ? (
        <div className="pbx-themes__editing">
          <h5 className="pbx-themes__editing-title">
            {t("themes.editing", { name: editingTheme.name })}
          </h5>

          <label className="pbx-themes__field">
            <span>{t("themes.name")}</span>
            <CommittableInput
              value={editingTheme.name}
              onCommit={(v) => updateThemeMeta(editingId!, { name: v })}
            />
          </label>

          <label className="pbx-themes__field">
            <span>{t("themes.extends")}</span>
            <PbxSelect
              value={editingTheme.extends ?? ""}
              onChange={(v) => updateThemeMeta(editingId!, { extends: v || null })}
              options={[
                { value: "", label: t("themes.extendsNone") },
                ...themeIds
                  .filter((id) => id !== editingId)
                  .map((id) => ({ value: id, label: themes![id]!.name })),
              ]}
            />
          </label>

          <label className="pbx-themes__field">
            <span>{t("themes.colorScheme")}</span>
            <PbxSelect
              value={editingTheme.colorScheme ?? ""}
              onChange={(v) =>
                updateThemeMeta(editingId!, {
                  colorScheme: (v || null) as "light" | "dark" | null,
                })
              }
              options={[
                { value: "", label: t("themes.schemeAuto") },
                { value: "light", label: t("themes.schemeLight") },
                { value: "dark", label: t("themes.schemeDark") },
              ]}
            />
          </label>

          {colorKeys.length > 0 ? (
            <div className="pbx-themes__tokens">
              <span className="pbx-themes__tokens-label">{t("themes.colors")}</span>
              {colorKeys.map((key) => {
                const path = `colors.${key}`;
                const raw = editingTheme.tokens[path];
                const override = typeof raw === "string" ? raw : undefined;
                return (
                  <ThemeColorRow
                    key={key}
                    themeId={editingId!}
                    colorKey={key}
                    override={override}
                    resolved={resolved[path]}
                  />
                );
              })}
            </div>
          ) : null}

          <ThemeScrollbarSection
            themeId={editingId!}
            thumb={typeof editingTheme.tokens["scrollbar.thumb"] === "string" ? (editingTheme.tokens["scrollbar.thumb"] as string) : undefined}
            track={typeof editingTheme.tokens["scrollbar.track"] === "string" ? (editingTheme.tokens["scrollbar.track"] as string) : undefined}
            size={typeof editingTheme.tokens["scrollbar.size"] === "string" ? (editingTheme.tokens["scrollbar.size"] as string) : undefined}
          />

          {contrast && !contrast.aaNormal ? (
            <p className="pbx-themes__contrast" role="alert">
              <WarnIcon size={13} aria-hidden="true" /> {t("themes.contrastWarn", { ratio: contrast.ratio.toFixed(2) })}
            </p>
          ) : contrast ? (
            <p className="pbx-themes__contrast pbx-themes__contrast--ok">
              <Check size={13} aria-hidden="true" /> {t("themes.contrastOk", { ratio: contrast.ratio.toFixed(2) })}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
