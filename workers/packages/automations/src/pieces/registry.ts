import type { PieceActionDefinition, PieceTriggerDefinition } from '@maildrill/activepieces-core';
import { campaignsPiece } from './campaigns';
import { emailPiece, smsPiece, voicePiece, whatsappPiece } from './channels';
import type { MaildrillPiece, MaildrillPieceContext } from './context';
import { dataPiece } from './data';
import { manualPiece, webhookPiece } from './entrypoints';
import { logicPiece } from './logic';
import { subscribersPiece } from './subscribers';

/**
 * The piece registry.
 *
 * v1 registers Maildrill-native pieces only. The registry is the extension point for
 * Activepieces integrations: an adapted upstream piece is added to this array and becomes
 * available to the composer, the validator and the executor without any of them changing.
 * What is NOT yet built is the sandbox those pieces need — see the architecture note §8.
 */
const PIECES: MaildrillPiece[] = [
  subscribersPiece,
  campaignsPiece,
  emailPiece,
  smsPiece,
  whatsappPiece,
  voicePiece,
  logicPiece,
  dataPiece,
  webhookPiece,
  manualPiece,
];

const byName = new Map(PIECES.map((piece) => [piece.name, piece]));

export function allPieces(): readonly MaildrillPiece[] {
  return PIECES;
}

export function getPiece(name: string): MaildrillPiece | undefined {
  return byName.get(name);
}

export function getAction(
  pieceName: string,
  actionName: string,
): PieceActionDefinition<MaildrillPieceContext> | undefined {
  return byName.get(pieceName)?.actions.find((a) => a.name === actionName);
}

export function getTrigger(
  pieceName: string,
  triggerName: string,
): PieceTriggerDefinition | undefined {
  return byName.get(pieceName)?.triggers.find((t) => t.name === triggerName);
}

export interface TriggerBinding {
  pieceName: string;
  pieceVersion: string;
  trigger: PieceTriggerDefinition;
}

/**
 * Domain event type → the triggers that listen for it. Built once: the dispatcher consults
 * it on every event, and a linear scan of every piece per event is the kind of cost that
 * only shows up under load.
 */
const byEventType = ((): Map<string, TriggerBinding[]> => {
  const index = new Map<string, TriggerBinding[]>();
  for (const piece of PIECES) {
    for (const trigger of piece.triggers) {
      for (const eventType of trigger.eventTypes) {
        const existing = index.get(eventType) ?? [];
        existing.push({ pieceName: piece.name, pieceVersion: piece.version, trigger });
        index.set(eventType, existing);
      }
    }
  }
  return index;
})();

export function triggersForEvent(eventType: string): readonly TriggerBinding[] {
  return byEventType.get(eventType) ?? [];
}

/** Every event type some trigger listens for — the dispatcher's fast reject. */
export function subscribedEventTypes(): readonly string[] {
  return [...byEventType.keys()];
}

// --- metadata for the composer ------------------------------------------------------
// Serialized server-side and fetched by the builder, so no piece definition, icon or
// implementation ever reaches the client bundle.

export interface PieceActionMetadata {
  name: string;
  displayName: string;
  description: string;
  category: string;
  accent: string | null;
  props: Record<string, unknown>;
  sampleOutput: unknown;
}

export interface PieceTriggerMetadata extends Omit<PieceActionMetadata, 'sampleOutput'> {
  samplePayload: unknown;
  eventTypes: readonly string[];
}

export interface PieceMetadata {
  name: string;
  displayName: string;
  description: string;
  version: string;
  accent: string | null;
  actions: PieceActionMetadata[];
  triggers: PieceTriggerMetadata[];
}

export function pieceCatalog(): PieceMetadata[] {
  return PIECES.map((piece) => ({
    name: piece.name,
    displayName: piece.displayName,
    description: piece.description,
    version: piece.version,
    accent: piece.accent ?? null,
    actions: piece.actions.map((action) => ({
      name: action.name,
      displayName: action.displayName,
      description: action.description,
      category: action.category,
      accent: action.accent ?? null,
      props: action.props as unknown as Record<string, unknown>,
      sampleOutput: action.sampleOutput ?? null,
    })),
    triggers: piece.triggers.map((trigger) => ({
      name: trigger.name,
      displayName: trigger.displayName,
      description: trigger.description,
      category: trigger.category,
      accent: trigger.accent ?? null,
      props: trigger.props as unknown as Record<string, unknown>,
      samplePayload: trigger.samplePayload ?? null,
      eventTypes: trigger.eventTypes,
    })),
  }));
}
