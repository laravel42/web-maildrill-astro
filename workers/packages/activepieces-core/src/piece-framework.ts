/**
 * Piece DSL — modelled on Activepieces' pieces-framework (MIT), reimplemented.
 *
 * Upstream shape: `createPiece` / `createAction` / `createTrigger` / `Property.*`.
 * The published `@activepieces/pieces-framework` is CommonJS, lags the upstream workspace
 * by many versions, and pulls `ai`, `dayjs`, `nanoid`, `semver` and `socket.io-client` into
 * a package Maildrill only needs types and prop builders from. The names, prop kinds and
 * `run({ propsValue })` contract are kept identical so an upstream piece can be adapted
 * mechanically when third-party pieces are enabled.
 *
 * The generic `RunContext` is a *port*: this package never imports a Maildrill service.
 */
export enum PropertyType {
  SHORT_TEXT = 'SHORT_TEXT',
  LONG_TEXT = 'LONG_TEXT',
  NUMBER = 'NUMBER',
  CHECKBOX = 'CHECKBOX',
  STATIC_DROPDOWN = 'STATIC_DROPDOWN',
  /** Options are fetched from the server at edit time (lists, segments, templates…). */
  DYNAMIC_DROPDOWN = 'DYNAMIC_DROPDOWN',
  MULTI_SELECT_DROPDOWN = 'MULTI_SELECT_DROPDOWN',
  DATE_TIME = 'DATE_TIME',
  JSON = 'JSON',
  OBJECT = 'OBJECT',
  ARRAY = 'ARRAY',
  /** Never rendered back to the browser once saved. */
  SECRET_TEXT = 'SECRET_TEXT',
  /** Editor renders the branch-condition builder. */
  CONDITIONS = 'CONDITIONS',
  /** Editor renders the duration control (value + unit). */
  DURATION = 'DURATION',
}

export interface PropertyOption {
  label: string;
  value: string | number | boolean;
}

export interface BaseProperty {
  displayName: string;
  description?: string;
  required: boolean;
  /** Shown under the field; the composer uses it for the variable hint. */
  placeholder?: string;
  defaultValue?: unknown;
}

export interface StaticDropdownProperty extends BaseProperty {
  type: PropertyType.STATIC_DROPDOWN | PropertyType.MULTI_SELECT_DROPDOWN;
  options: PropertyOption[];
}

export interface DynamicDropdownProperty extends BaseProperty {
  type: PropertyType.DYNAMIC_DROPDOWN;
  /** Resource the composer asks the server for: `lists`, `segments`, `templates:email`… */
  source: string;
}

export interface SimpleProperty extends BaseProperty {
  type: Exclude<
    PropertyType,
    | PropertyType.STATIC_DROPDOWN
    | PropertyType.MULTI_SELECT_DROPDOWN
    | PropertyType.DYNAMIC_DROPDOWN
  >;
}

export type PieceProperty = SimpleProperty | StaticDropdownProperty | DynamicDropdownProperty;

export type PieceProps = Record<string, PieceProperty>;

const base = (opts: Omit<BaseProperty, 'required'> & { required?: boolean }): BaseProperty => ({
  required: opts.required ?? false,
  displayName: opts.displayName,
  description: opts.description,
  placeholder: opts.placeholder,
  defaultValue: opts.defaultValue,
});

type SimpleOpts = Omit<BaseProperty, 'required'> & { required?: boolean };

/** Mirrors upstream's `Property.*` builders. */
export const Property = {
  ShortText: (o: SimpleOpts): SimpleProperty => ({ ...base(o), type: PropertyType.SHORT_TEXT }),
  LongText: (o: SimpleOpts): SimpleProperty => ({ ...base(o), type: PropertyType.LONG_TEXT }),
  Number: (o: SimpleOpts): SimpleProperty => ({ ...base(o), type: PropertyType.NUMBER }),
  Checkbox: (o: SimpleOpts): SimpleProperty => ({ ...base(o), type: PropertyType.CHECKBOX }),
  DateTime: (o: SimpleOpts): SimpleProperty => ({ ...base(o), type: PropertyType.DATE_TIME }),
  Json: (o: SimpleOpts): SimpleProperty => ({ ...base(o), type: PropertyType.JSON }),
  Object: (o: SimpleOpts): SimpleProperty => ({ ...base(o), type: PropertyType.OBJECT }),
  Array: (o: SimpleOpts): SimpleProperty => ({ ...base(o), type: PropertyType.ARRAY }),
  SecretText: (o: SimpleOpts): SimpleProperty => ({ ...base(o), type: PropertyType.SECRET_TEXT }),
  Conditions: (o: SimpleOpts): SimpleProperty => ({ ...base(o), type: PropertyType.CONDITIONS }),
  Duration: (o: SimpleOpts): SimpleProperty => ({ ...base(o), type: PropertyType.DURATION }),
  StaticDropdown: (o: SimpleOpts & { options: PropertyOption[] }): StaticDropdownProperty => ({
    ...base(o),
    type: PropertyType.STATIC_DROPDOWN,
    options: o.options,
  }),
  MultiSelectDropdown: (o: SimpleOpts & { options: PropertyOption[] }): StaticDropdownProperty => ({
    ...base(o),
    type: PropertyType.MULTI_SELECT_DROPDOWN,
    options: o.options,
  }),
  DynamicDropdown: (o: SimpleOpts & { source: string }): DynamicDropdownProperty => ({
    ...base(o),
    type: PropertyType.DYNAMIC_DROPDOWN,
    source: o.source,
  }),
};

/** What an action's `run` receives. `CTX` is supplied by the host (Maildrill). */
export interface ActionContext<CTX> {
  propsValue: Record<string, unknown>;
  ctx: CTX;
}

/**
 * A piece's action *definition*. Named `…Definition` rather than upstream's `PieceAction`
 * because that name is already taken in this package by the flow-model node type — the
 * two are different things (a definition vs. an instance of it in a flow), and upstream
 * keeps them in separate packages where the collision does not arise.
 */
export interface PieceActionDefinition<CTX> {
  name: string;
  displayName: string;
  description: string;
  props: PieceProps;
  /** Shown in the step picker; groups the action under a category. */
  category: string;
  /** Design-token colour role for the node chip, e.g. `--ch-email`. */
  accent?: string;
  /** Example output, so the variable picker can offer fields before the first run. */
  sampleOutput?: unknown;
  run: (context: ActionContext<CTX>) => Promise<unknown>;
}

/** A piece's trigger definition (see `PieceActionDefinition` on the naming). */
export interface PieceTriggerDefinition {
  name: string;
  displayName: string;
  description: string;
  props: PieceProps;
  category: string;
  accent?: string;
  /**
   * Maildrill domain events that start this trigger. Empty means the trigger is not
   * event-driven (webhook or manual).
   */
  eventTypes: readonly string[];
  /** Shape of `{{trigger}}`, powering the variable picker before any run exists. */
  samplePayload: unknown;
  /**
   * Extra gate applied after the event type matches, e.g. "only for list X".
   * Returns false to skip the automation for this event.
   */
  matches?: (params: { propsValue: Record<string, unknown>; payload: unknown }) => boolean;
}

export interface Piece<CTX> {
  name: string;
  displayName: string;
  description: string;
  version: string;
  /** Design-token colour role for the piece badge. */
  accent?: string;
  actions: PieceActionDefinition<CTX>[];
  triggers: PieceTriggerDefinition[];
}

export function defineAction<CTX>(action: PieceActionDefinition<CTX>): PieceActionDefinition<CTX> {
  return action;
}

export function defineTrigger(trigger: PieceTriggerDefinition): PieceTriggerDefinition {
  return trigger;
}

export function definePiece<CTX>(piece: Piece<CTX>): Piece<CTX> {
  return piece;
}
