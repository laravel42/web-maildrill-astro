import * as React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronLeft, MoreVertical, Phone, Video } from 'lucide-react';

import { getBlockPlugin, getButtonPlugin } from '@/core/registry';
import { select, useStudio, type Selection } from '@/core/store';
import type { PreviewContext, TemplateDoc } from '@/core/types';
import type { VariableMap } from '@/core/variables';

/**
 * Center canvas: a faithful WhatsApp conversation preview inside a
 * device frame. Every block renders through its plugin's Preview;
 * clicking selects (highlight ring); the whole bubble is a dnd drop
 * target for library tiles.
 */

function resolveVariableFactory(doc: TemplateDoc): (n: number) => string {
  const bodyData = doc.blocks.body.data as { variables?: VariableMap };
  const headerData = (doc.blocks.header?.data ?? {}) as { variables?: VariableMap };
  return (n: number) =>
    bodyData.variables?.[String(n)]?.example ?? headerData.variables?.[String(n)]?.example ?? '';
}

function SelectableRegion({
  children,
  active,
  onSelect,
  label,
}: {
  children: React.ReactNode;
  active: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Edit ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`relative cursor-pointer rounded-[5px] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring ${
        active ? 'ring-2 ring-primary ring-offset-1 ring-offset-transparent' : 'hover:ring-2 hover:ring-primary/35'
      }`}
    >
      {children}
    </div>
  );
}

const VISIBLE_BUTTONS = 3;

export function CanvasPanel() {
  const doc = useStudio((s) => s.doc);
  const selection = useStudio((s) => s.selection);
  const dark = useStudio((s) => s.previewDark);
  const device = useStudio((s) => s.previewDevice);

  const { setNodeRef, isOver } = useDroppable({ id: 'canvas-drop' });

  const ctx: PreviewContext = React.useMemo(
    () => ({ doc, dark, resolveVariable: resolveVariableFactory(doc) }),
    [doc, dark]
  );

  const isSelected = (check: Selection) =>
    JSON.stringify(selection) === JSON.stringify(check);

  const buttons = doc.blocks.buttons;
  const collapsed = buttons.length > VISIBLE_BUTTONS;
  const visibleButtons = collapsed ? buttons.slice(0, VISIBLE_BUTTONS - 1) : buttons;

  const frameWidth = device === 'mobile' ? 360 : 480;

  return (
    <main
      aria-label="Preview canvas"
      className="flex min-w-0 flex-1 items-start justify-center overflow-auto bg-muted/50 p-6 lg:p-10"
      onClick={() => select({ kind: 'template' })}
    >
      <div
        className="overflow-hidden rounded-[22px] border border-border shadow-2xl"
        style={{ width: frameWidth, maxWidth: '100%' }}
      >
        {/* Chat header */}
        <div
          className={`flex items-center gap-2.5 px-3 py-2.5 ${
            dark ? 'bg-[#202c33] text-[#e9edef]' : 'bg-[#008069] text-white'
          }`}
        >
          <ChevronLeft className="size-5 opacity-90" />
          <span className="flex size-8 items-center justify-center rounded-full bg-white/25 text-[13px] font-semibold">
            M
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14.5px] font-semibold leading-tight">Maildrill</div>
            <div className="text-[11px] leading-tight opacity-75">WhatsApp Business</div>
          </div>
          <Video className="size-[18px] opacity-90" />
          <Phone className="size-4 opacity-90" />
          <MoreVertical className="size-[18px] opacity-90" />
        </div>

        {/* Chat surface */}
        <div
          ref={setNodeRef}
          className={`min-h-[420px] p-4 pt-6 transition-shadow ${isOver ? 'shadow-[inset_0_0_0_2px_var(--color-primary)]' : ''}`}
          style={{
            backgroundColor: dark ? 'var(--wa-chat-dark)' : 'var(--wa-chat-light)',
            backgroundImage: `radial-gradient(${dark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)'} 1.2px, transparent 1.2px)`,
            backgroundSize: '18px 18px',
          }}
        >
          {/* Message bubble */}
          <div
            className="relative max-w-[85%] rounded-lg rounded-tl-none p-[3px] pb-1 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]"
            style={{ backgroundColor: dark ? 'var(--wa-bubble-dark)' : 'var(--wa-bubble-light)' }}
          >
            <span
              aria-hidden
              className="absolute -left-2 top-0 h-[13px] w-2"
              style={{
                backgroundColor: dark ? 'var(--wa-bubble-dark)' : 'var(--wa-bubble-light)',
                clipPath: 'polygon(100% 0, 100% 100%, 0 0)',
              }}
            />
            <AnimatePresence initial={false}>
              {doc.blocks.header &&
                (() => {
                  const header = doc.blocks.header;
                  const plugin = getBlockPlugin(header.type);
                  if (!plugin) return null;
                  return (
                    <motion.div
                      key={header.id}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                    >
                      <SelectableRegion
                        label="header"
                        active={isSelected({ kind: 'block', slot: 'header', id: header.id })}
                        onSelect={() => select({ kind: 'block', slot: 'header', id: header.id })}
                      >
                        <plugin.Preview data={header.data} ctx={ctx} />
                      </SelectableRegion>
                    </motion.div>
                  );
                })()}
            </AnimatePresence>

            {(() => {
              const body = doc.blocks.body;
              const plugin = getBlockPlugin(body.type);
              if (!plugin) return null;
              return (
                <SelectableRegion
                  label="body"
                  active={isSelected({ kind: 'block', slot: 'body', id: body.id })}
                  onSelect={() => select({ kind: 'block', slot: 'body', id: body.id })}
                >
                  <plugin.Preview data={body.data} ctx={ctx} />
                </SelectableRegion>
              );
            })()}

            <AnimatePresence initial={false}>
              {doc.blocks.footer &&
                (() => {
                  const footer = doc.blocks.footer;
                  const plugin = getBlockPlugin(footer.type);
                  if (!plugin) return null;
                  return (
                    <motion.div key={footer.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <SelectableRegion
                        label="footer"
                        active={isSelected({ kind: 'block', slot: 'footer', id: footer.id })}
                        onSelect={() => select({ kind: 'block', slot: 'footer', id: footer.id })}
                      >
                        <plugin.Preview data={footer.data} ctx={ctx} />
                      </SelectableRegion>
                    </motion.div>
                  );
                })()}
            </AnimatePresence>

            <div className={`px-[9px] pb-[2px] pt-[3px] text-right text-[11px] leading-none ${dark ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
              10:24
            </div>

            {/* Buttons attach inside the bubble, divider-separated. */}
            <AnimatePresence initial={false}>
              {visibleButtons.map((button) => {
                const plugin = getButtonPlugin(button.type);
                if (!plugin) return null;
                return (
                  <motion.div key={button.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <SelectableRegion
                      label={`${plugin.meta.label} button`}
                      active={isSelected({ kind: 'button', id: button.id })}
                      onSelect={() => select({ kind: 'button', id: button.id })}
                    >
                      <plugin.Preview data={button.data} ctx={ctx} />
                    </SelectableRegion>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {collapsed && (
              <div
                className={`flex items-center justify-center gap-1.5 border-t py-[10px] text-[14px] font-medium ${
                  dark ? 'border-[#e9edef]/10 text-[#53bdeb]' : 'border-[#111b21]/10 text-[#00a5f4]'
                }`}
              >
                <ChevronDown className="size-4" />
                See all options
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
