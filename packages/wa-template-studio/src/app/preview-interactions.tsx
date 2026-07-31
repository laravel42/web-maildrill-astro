import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCheck,
  ExternalLink,
  LayoutGrid,
  Phone,
  ShoppingBag,
  Workflow,
  X,
} from 'lucide-react';

import { getButtonPlugin } from '@/core/registry';
import { closePreviewSheet, type PreviewReply } from '@/core/store';
import type { ButtonInstance, InteractionApi, PreviewContext, PreviewSheet } from '@/core/types';

/**
 * Test-mode furniture for the phone frame: outgoing reply bubbles,
 * WhatsApp-style bottom sheets (link/call/flow/catalog/options) and the
 * "Copied" snackbar. Pure presentation — behavior comes from the
 * plugins' `onTap` via the InteractionApi.
 */

export function ReplyBubble({ reply, dark }: { reply: PreviewReply; dark: boolean }) {
  const now = new Date();
  const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', duration: 0.35, bounce: 0.2 }}
      className="mt-2 flex justify-end"
    >
      <div
        className="relative max-w-[85%] rounded-lg rounded-tr-none px-2 py-1.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]"
        style={{ backgroundColor: dark ? '#005c4b' : '#d9fdd3' }}
      >
        <span
          aria-hidden
          className="absolute -right-2 top-0 h-[13px] w-2"
          style={{
            backgroundColor: dark ? '#005c4b' : '#d9fdd3',
            clipPath: 'polygon(0 0, 100% 0, 0 100%)',
          }}
        />
        <span
          className={`text-[14.2px] leading-[19px] ${dark ? 'text-[#e9edef]' : 'text-[#111b21]'}`}
        >
          {reply.text}
        </span>
        <span
          className={`ml-2 inline-flex translate-y-[2px] items-center gap-0.5 text-[11px] ${dark ? 'text-[#8696a0]' : 'text-[#667781]'}`}
        >
          {time}
          <CheckCheck className="size-3.5 text-[#53bdeb]" />
        </span>
      </div>
    </motion.div>
  );
}

export function PreviewSnackbar({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center"
        >
          <span className="rounded-full bg-[#1f2c33]/95 px-3.5 py-2 text-[12.5px] font-medium text-[#e9edef] shadow-lg">
            {message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SheetShell({
  dark,
  title,
  children,
}: {
  dark: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <motion.button
        type="button"
        aria-label="Dismiss"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closePreviewSheet}
        className="absolute inset-0 z-20 bg-black/45"
      />
      <motion.div
        role="dialog"
        aria-label={title ?? 'WhatsApp sheet'}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', duration: 0.4, bounce: 0.1 }}
        className={`absolute inset-x-0 bottom-0 z-20 rounded-t-2xl p-4 pb-5 shadow-2xl ${
          dark ? 'bg-[#233138] text-[#e9edef]' : 'bg-white text-[#111b21]'
        }`}
      >
        <div
          className={`mx-auto mb-3 h-1 w-9 rounded-full ${dark ? 'bg-[#8696a0]/40' : 'bg-[#111b21]/15'}`}
        />
        {title && <div className="mb-2 text-[15px] font-semibold">{title}</div>}
        {children}
      </motion.div>
    </>
  );
}

function SheetActions({
  dark,
  confirmLabel,
  onConfirm,
}: {
  dark: boolean;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const base = 'flex-1 rounded-full py-2 text-[13.5px] font-semibold transition-colors';
  return (
    <div className="mt-4 flex gap-2.5">
      <button
        type="button"
        onClick={closePreviewSheet}
        className={`${base} ${dark ? 'border border-[#8696a0]/40 text-[#00a884]' : 'border border-[#008069]/30 text-[#008069]'}`}
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className={`${base} ${dark ? 'bg-[#00a884] text-[#111b21]' : 'bg-[#008069] text-white'}`}
      >
        {confirmLabel}
      </button>
    </div>
  );
}

export function PhoneSheet({
  sheet,
  dark,
  buttons,
  api,
  ctx,
}: {
  sheet: PreviewSheet | null;
  dark: boolean;
  buttons: ButtonInstance[];
  api: InteractionApi;
  ctx: PreviewContext;
}) {
  return (
    <AnimatePresence>
      {sheet && (
        <React.Fragment key={sheet.kind}>
          {sheet.kind === 'link' && (
            <SheetShell dark={dark} title="Open this link?">
              <div
                className={`flex items-center gap-2 break-all text-[13px] ${dark ? 'text-[#8696a0]' : 'text-[#667781]'}`}
              >
                <ExternalLink className="size-4 shrink-0" />
                {sheet.url}
              </div>
              <SheetActions
                dark={dark}
                confirmLabel="Open"
                onConfirm={() => {
                  closePreviewSheet();
                  api.toast('Opened in browser');
                }}
              />
            </SheetShell>
          )}
          {sheet.kind === 'call' && (
            <SheetShell dark={dark} title={sheet.label}>
              <div className={`flex items-center gap-2 text-[15px] font-medium`}>
                <Phone className="size-4 text-[#00a884]" />
                {sheet.phoneNumber}
              </div>
              <SheetActions
                dark={dark}
                confirmLabel="Call"
                onConfirm={() => {
                  closePreviewSheet();
                  api.toast(`Calling ${sheet.phoneNumber}…`);
                }}
              />
            </SheetShell>
          )}
          {sheet.kind === 'flow' && (
            <SheetShell dark={dark} title={sheet.label}>
              <div
                className={`flex flex-col items-center gap-2 py-6 ${dark ? 'text-[#8696a0]' : 'text-[#667781]'}`}
              >
                <Workflow className="size-8 text-[#00a884]" />
                <div className="text-[13px]">
                  WhatsApp Flow <span className="font-mono">{sheet.flowId}</span>
                  {sheet.screen ? ` · ${sheet.screen}` : ''}
                </div>
                <div className="text-[12px] opacity-75">
                  Flows render their own screens at send time.
                </div>
              </div>
              <SheetActions
                dark={dark}
                confirmLabel="Continue"
                onConfirm={() => {
                  closePreviewSheet();
                  api.toast('Flow opened');
                }}
              />
            </SheetShell>
          )}
          {sheet.kind === 'catalog' && (
            <SheetShell dark={dark} title={sheet.label}>
              <div className="grid grid-cols-3 gap-2 py-1">
                {Array.from({ length: sheet.multi ? 6 : 3 }, (_, i) => (
                  <div
                    key={i}
                    className={`flex aspect-square items-center justify-center rounded-lg ${
                      dark ? 'bg-[#2a3942] text-[#8696a0]' : 'bg-[#f0f2f5] text-[#667781]'
                    }`}
                  >
                    {sheet.multi ? (
                      <ShoppingBag className="size-5" />
                    ) : (
                      <LayoutGrid className="size-5" />
                    )}
                  </div>
                ))}
              </div>
              <div className={`pt-1 text-[12px] ${dark ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                Products attach from your catalog at send time.
              </div>
              <SheetActions
                dark={dark}
                confirmLabel="View"
                onConfirm={() => {
                  closePreviewSheet();
                  api.toast('Catalog opened');
                }}
              />
            </SheetShell>
          )}
          {sheet.kind === 'options' && (
            <SheetShell dark={dark}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[15px] font-semibold">All options</span>
                <button type="button" aria-label="Close" onClick={closePreviewSheet}>
                  <X className={`size-4 ${dark ? 'text-[#8696a0]' : 'text-[#667781]'}`} />
                </button>
              </div>
              <div className="flex flex-col">
                {buttons.map((b) => {
                  const plugin = getButtonPlugin(b.type);
                  if (!plugin) return null;
                  const Preview = plugin.Preview;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      aria-label={`Tap ${plugin.meta.label}`}
                      className="text-left"
                      onClick={() => {
                        closePreviewSheet();
                        if (plugin.onTap) plugin.onTap(b.data, api);
                        else api.toast('This button has no preview action');
                      }}
                    >
                      <Preview data={b.data} ctx={ctx} />
                    </button>
                  );
                })}
              </div>
            </SheetShell>
          )}
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}
