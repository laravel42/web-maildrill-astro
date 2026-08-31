/**
 * src/components/ — Capa de componentes UI reutilizables del proyecto.
 *
 * Centraliza los componentes de c42 que usamos y los wrappers de proyecto con
 * estilo/lógica compartida. Los consumers (app/, builder/inspector/) importan
 * desde aquí en vez de ir directo a c42-react — así un cambio de API de c42 o
 * un swap de primitivo solo se toca en un lugar.
 *
 * Regla (AGENTS.md §7, P8): estos componentes son CHROME del editor. Nunca se
 * importan desde registry/components/ ni desde export/.
 */

// --- Re-exports de c42-react (controladores que usamos) ---------------------
export { Tabs } from "@josecortez1/c42-react";
export { Select } from "@josecortez1/c42-react";
export { Dropdown } from "@josecortez1/c42-react";
export { Combobox } from "@josecortez1/c42-react";
export { Tree } from "@josecortez1/c42-react";
export { Modal } from "@josecortez1/c42-react";
export { Tooltip } from "@josecortez1/c42-react";

// --- Componentes de proyecto ------------------------------------------------
export { LanguageSelect } from "./LanguageSelect";
export { ContentLocaleSelect } from "./ContentLocaleSelect";
export { FontFamilyCombobox } from "./FontFamilyCombobox";
export type { FontFamilyComboboxProps } from "./FontFamilyCombobox";
export { LocaleCombobox } from "./LocaleCombobox";
export type { LocaleComboboxProps } from "./LocaleCombobox";
export { TiptapEditor } from "./TiptapEditor";
export type { TiptapEditorProps } from "./TiptapEditor";
export { ComponentTypeIcon } from "./ComponentTypeIcon";
export { Toggle } from "./Toggle";
export { IconButton } from "./IconButton";
export { ColorPicker } from "./ColorPicker";
export type { ColorPickerProps } from "./ColorPicker";
export type {
  IconButtonProps,
  IconButtonSize,
  IconButtonIntent,
} from "./IconButton";
export { ErrorBoundary } from "./ErrorBoundary";
export { ExportWarningsBanner } from "./ExportWarningsBanner";
export { SimpleModal } from "./SimpleModal";
export type { SimpleModalProps } from "./SimpleModal";
export { Toast, ToastHost, useToast } from "./Toast";
export type { ToastProps, ToastState } from "./Toast";

// --- Iconos Lucide del chrome (Fase 11.f) -----------------------------------
export * from "./Icon";
