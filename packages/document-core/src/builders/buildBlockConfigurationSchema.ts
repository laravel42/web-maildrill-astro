import { z } from 'zod';

import { BaseZodDictionary, BlockConfiguration, DocumentBlocksDictionary } from '../utils';

/**
 *
 * @param blocks Main DocumentBlocksDictionary
 * @returns zod schema that can parse arbitary objects into a single BlockConfiguration
 */
export default function buildBlockConfigurationSchema<T extends BaseZodDictionary>(
  blocks: DocumentBlocksDictionary<T>
) {
  // `type` stays a plain string here: zod 4's `z.literal` accepts `string | number | bigint |
  // boolean | null | undefined`, so passing `keyof T` (which includes `symbol`) no longer compiles.
  const blockObjects = Object.keys(blocks).map((type) =>
    z.object({
      type: z.literal(type),
      data: blocks[type as keyof T].schema,
    })
  );

  return z.discriminatedUnion('type', blockObjects as any).transform((v) => v as BlockConfiguration<T>);
}
