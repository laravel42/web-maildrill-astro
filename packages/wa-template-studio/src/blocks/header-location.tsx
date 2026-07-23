import * as React from 'react';
import { z } from 'zod';
import { MapPin } from 'lucide-react';

import { Field } from '@/ui/field';
import { Input } from '@/ui/input';
import type { BlockPlugin } from '@/core/types';

/**
 * Location header. Meta needs no design-time payload (coordinates are
 * send-time parameters); name/address here feed the preview only.
 */
const schema = z.object({
  name: z.string(),
  address: z.string(),
});

type Data = z.infer<typeof schema>;

export const headerLocationPlugin: BlockPlugin<Data> = {
  type: 'header-location',
  slot: 'header',
  meta: {
    label: 'Location header',
    description: 'Map pin with name and address (set at send time)',
    group: 'Headers',
    icon: MapPin,
    keywords: ['map', 'address', 'pin', 'geo'],
  },
  schema,
  defaults: () => ({ name: '', address: '' }),
  availableIn: (category) =>
    category === 'AUTHENTICATION'
      ? { available: false, reason: 'Authentication templates have no custom header' }
      : { available: true },
  validate: () => [],
  Editor: function HeaderLocationEditor({ value, onChange }) {
    return (
      <div className="flex flex-col gap-4">
        <Field label="Place name" hint="Preview only — real values are sent per message">
          <Input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="Maildrill HQ" />
        </Field>
        <Field label="Address">
          <Input
            value={value.address}
            onChange={(e) => onChange({ ...value, address: e.target.value })}
            placeholder="Via Roma 1, Milano"
          />
        </Field>
      </div>
    );
  },
  Preview: function HeaderLocationPreview({ data, ctx }) {
    return (
      <div className="overflow-hidden rounded-[6px]">
        <div
          className={`flex h-[86px] items-center justify-center ${
            ctx.dark ? 'bg-[#2a3942] text-[#8696a0]' : 'bg-[#dbe4d9] text-[#5b7360]'
          }`}
        >
          <MapPin className="size-8" />
        </div>
        {(data.name || data.address) && (
          <div className={`px-[9px] py-[5px] ${ctx.dark ? 'bg-[#1d282f]' : 'bg-[#f5f6f6]'}`}>
            <div className={`text-[13px] font-semibold ${ctx.dark ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>{data.name}</div>
            <div className={`text-[11.5px] ${ctx.dark ? 'text-[#8696a0]' : 'text-[#667781]'}`}>{data.address}</div>
          </div>
        )}
      </div>
    );
  },
  toMeta: () => ({ type: 'HEADER', format: 'LOCATION' }),
  fromMeta: (component) => {
    if (String(component.type).toUpperCase() !== 'HEADER') return null;
    if (String(component.format ?? '').toUpperCase() !== 'LOCATION') return null;
    return { name: '', address: '' };
  },
};
