import type { ReactElement } from 'react';
import { z } from 'zod';

export type BaseZodDictionary = { [name: string]: z.ZodObject };
/** Runtime passes `blockId` / `isNotClient` from buildBlockComponent in addition to schema `data` fields. */
export type BlockEditorComponentProps<TSchema extends z.ZodObject> = z.infer<TSchema> & {
  blockId?: string;
  isNotClient?: boolean;
};

export type DocumentBlocksDictionary<T extends BaseZodDictionary> = {
  [K in keyof T]: {
    schema: T[K];
    Component: (props: BlockEditorComponentProps<T[K]>) => ReactElement;
  };
};

export type BlockConfiguration<T extends BaseZodDictionary> = {
  [TType in keyof T]: {
    type: TType;
    data: z.infer<T[TType]>;
    blockId?: string;
  };
}[keyof T];

export class BlockNotFoundError extends Error {
  blockId: string;
  constructor(blockId: string) {
    super('Could not find a block with the given blockId');
    this.blockId = blockId;
  }
}
