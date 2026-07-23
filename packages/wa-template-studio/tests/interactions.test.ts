import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerBuiltInPlugins } from '../src/blocks';
import { quickReplyPlugin } from '../src/blocks/buttons/basic';
import { getButtonPlugin } from '../src/core/registry';
import {
  openPreviewSheet,
  pushPreviewReply,
  resetPreviewInteractions,
  setPreviewMode,
  useStudio,
} from '../src/core/store';
import type { InteractionApi } from '../src/core/types';

beforeAll(() => {
  registerBuiltInPlugins();
});

function apiSpy(): { api: InteractionApi; calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = { reply: [], copy: [], openSheet: [], toast: [] };
  const api: InteractionApi = {
    reply: (...a) => void calls.reply!.push(a),
    copy: (...a) => void calls.copy!.push(a),
    openSheet: (...a) => void calls.openSheet!.push(a),
    toast: (...a) => void calls.toast!.push(a),
  };
  return { api, calls };
}

describe('button onTap behaviors (Test mode)', () => {
  it('quick reply (unregistered by default) still ships a reply behavior', () => {
    const { api, calls } = apiSpy();
    quickReplyPlugin.onTap!({ text: 'Count me in' }, api);
    expect(calls.reply).toEqual([['Count me in']]);
    expect(getButtonPlugin('quick-reply')).toBeUndefined();
  });

  it('URL button opens the link sheet, resolving a dynamic suffix from the example', () => {
    const { api, calls } = apiSpy();
    getButtonPlugin('url')!.onTap!(
      { text: 'View order', url: 'https://shop.com/o/{{1}}', example: 'https://shop.com/o/1042' },
      api
    );
    expect(calls.openSheet).toEqual([[{ kind: 'link', url: 'https://shop.com/o/1042' }]]);
  });

  it('phone button opens the call sheet', () => {
    const { api, calls } = apiSpy();
    getButtonPlugin('phone')!.onTap!({ text: 'Call us', phoneNumber: '+1555' }, api);
    expect(calls.openSheet).toEqual([[{ kind: 'call', phoneNumber: '+1555', label: 'Call us' }]]);
  });

  it('copy-code copies the offer code', () => {
    const { api, calls } = apiSpy();
    getButtonPlugin('copy-code')!.onTap!({ example: 'SAVE20' }, api);
    expect(calls.copy).toEqual([['SAVE20', 'Offer code copied']]);
  });

  it('OTP copy-code copies; one-tap hands off to the app instead', () => {
    const copyCase = apiSpy();
    getButtonPlugin('otp')!.onTap!({ otpType: 'COPY_CODE', text: 'Copy code' }, copyCase.api);
    expect(copyCase.calls.copy!.length).toBe(1);

    const oneTap = apiSpy();
    getButtonPlugin('otp')!.onTap!({ otpType: 'ONE_TAP', packageName: 'com.x' }, oneTap.api);
    expect(oneTap.calls.copy!.length).toBe(0);
    expect(oneTap.calls.toast).toEqual([['Code sent to com.x']]);
  });

  it('flow, catalog and MPM open their sheets', () => {
    const flow = apiSpy();
    getButtonPlugin('flow')!.onTap!({ text: 'Book', flowId: '42', flowAction: 'navigate', navigateScreen: 'HOME' }, flow.api);
    expect(flow.calls.openSheet).toEqual([[{ kind: 'flow', label: 'Book', flowId: '42', screen: 'HOME' }]]);

    const catalog = apiSpy();
    getButtonPlugin('catalog')!.onTap!({ text: 'View catalog' }, catalog.api);
    expect(catalog.calls.openSheet).toEqual([[{ kind: 'catalog', label: 'View catalog', multi: false }]]);

    const mpm = apiSpy();
    getButtonPlugin('mpm')!.onTap!({ text: 'View items' }, mpm.api);
    expect(mpm.calls.openSheet).toEqual([[{ kind: 'catalog', label: 'View items', multi: true }]]);
  });

  it('every registered button plugin defines a tap behavior', () => {
    for (const type of ['url', 'phone', 'copy-code', 'otp', 'flow', 'catalog', 'mpm']) {
      expect(getButtonPlugin(type)!.onTap, `${type} should define onTap`).toBeTypeOf('function');
    }
  });
});

describe('preview interaction state', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setPreviewMode('edit');
  });

  it('mode switches clear the conversation and deselect in Test mode', () => {
    pushPreviewReply('hello');
    openPreviewSheet({ kind: 'options' });
    setPreviewMode('interact');
    const s = useStudio.getState();
    expect(s.previewReplies).toEqual([]);
    expect(s.previewSheet).toBeNull();
    expect(s.selection).toEqual({ kind: 'none' });
  });

  it('replies accumulate and reset', () => {
    setPreviewMode('interact');
    pushPreviewReply('one');
    pushPreviewReply('two');
    expect(useStudio.getState().previewReplies.map((r) => r.text)).toEqual(['one', 'two']);
    resetPreviewInteractions();
    expect(useStudio.getState().previewReplies).toEqual([]);
  });
});
