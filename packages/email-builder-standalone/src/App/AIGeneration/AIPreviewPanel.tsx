import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Reader, type TReaderDocument } from '@eb/email-builder';
import { Box, LinearProgress, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

import type { AIGenerateTemplateResponse } from '../..';
import type { TEditorBlock, TEditorConfiguration } from '../../documents/editor/core';
import EditorRenderContextBridge from '../../documents/editor/EditorRenderContextBridge';

import { type NDJSONEvent, parseNDJSONStream } from './ndjsonStreamClient';
import { repairDocument } from './repairOrphanedBlocks';

type AIPreviewPanelProps = {
  /** Resolved response from the host's `onAIGenerateTemplate` callback. */
  response: AIGenerateTemplateResponse;
  /**
   * Called exactly once when the stream terminates successfully (or a sync
   * `TEditorConfiguration` was returned). `meta` carries non-fatal findings
   * from the stream so the dialog can surface them as validation issues:
   *
   * - `duplicateIds` — ids the client saw more than once (safety net; the
   *   backend now drops duplicates server-side, so these should normally be
   *   empty).
   * - `streamErrors` — `event: error` frames (e.g. malformed lines emitted
   *   by the backend when the LLM produces truncated JSON).
   * - `streamWarnings` — `event: warning` frames (e.g. duplicate ids the
   *   backend dropped for us).
   */
  onComplete: (
    document: TEditorConfiguration,
    meta: {
      duplicateIds: string[];
      streamErrors: string[];
      streamWarnings: string[];
    },
  ) => void;
  /** Called exactly once for catastrophic failures (parser threw, stream aborted, no document assembled). */
  onError: (message: string) => void;
};

/**
 * Flatten an `event: error` / `event: warning` payload into a single-line
 * message suitable for rendering in the dialog's validation issues list.
 *
 * Handles three shapes the backend emits today:
 *   - `{ type: 'malformed_line', line }` → `"Malformed line: ..."`
 *   - `{ type: 'duplicate_id', id, action }` → `"Duplicate id ... dropped"`
 *   - anything else (including plain strings) → JSON string fallback
 */
function formatPayloadMessage(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (payload !== null && typeof payload === 'object') {
    const p = payload as {
      type?: unknown;
      id?: unknown;
      action?: unknown;
      line?: unknown;
      message?: unknown;
    };
    if (p.type === 'malformed_line') {
      const preview = typeof p.line === 'string' ? p.line.slice(0, 160) : '';
      return preview
        ? `Backend reported a malformed JSON line: ${preview}${p.line && (p.line as string).length > 160 ? '…' : ''}`
        : 'Backend reported a malformed JSON line';
    }
    if (p.type === 'duplicate_id') {
      const id = typeof p.id === 'string' ? p.id : '<unknown>';
      const action = typeof p.action === 'string' ? p.action : 'reported';
      if (action === 'remapped' && typeof (p as { remappedTo?: unknown }).remappedTo === 'string') {
        const remappedTo = (p as { remappedTo: string }).remappedTo;
        return `Backend remapped duplicate block id "${id}" → "${remappedTo}" (the block is in the document but is probably orphaned; reattach it manually if needed)`;
      }
      return `Backend ${action} a duplicate block id: "${id}"`;
    }
    if (typeof p.message === 'string') return p.message;
  }
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

/**
 * Determine whether the response is a streaming source. A streaming response
 * is either a `ReadableStream` or an `AsyncIterable` (i.e. has a
 * `[Symbol.asyncIterator]`). Anything else is treated as a full
 * `TEditorConfiguration` that was produced synchronously by the consumer.
 */
function isStreamingResponse(
  response: AIGenerateTemplateResponse,
): response is ReadableStream<string> | AsyncIterable<string> {
  if (response == null || typeof response !== 'object') return false;
  if (typeof ReadableStream !== 'undefined' && response instanceof ReadableStream) return true;
  return typeof (response as any)[Symbol.asyncIterator] === 'function';
}

/**
 * Read `childrenIds` off a block defensively. Root (`EmailLayout`) stores
 * them under `data.childrenIds`; `Container` / `ColumnsContainer` nest them
 * under `data.props.childrenIds`. Either shape is accepted.
 */
function extractChildrenIds(block: TEditorBlock): string[] {
  const data = block.data as
    { childrenIds?: unknown; props?: { childrenIds?: unknown } } | undefined;
  const rootLevel = data?.childrenIds;
  if (Array.isArray(rootLevel)) return rootLevel.filter((v): v is string => typeof v === 'string');
  const propsLevel = data?.props?.childrenIds;
  if (Array.isArray(propsLevel))
    return propsLevel.filter((v): v is string => typeof v === 'string');
  return [];
}

/**
 * Produce a subset of `acc` safe to hand to `Reader` while the stream is
 * in-flight. Specifically: drop `childrenIds` entries that reference blocks
 * not yet received, so `ReaderBlock` never tries to spread `document[id]`
 * against `undefined`. The filter runs BFS from `root` and returns only
 * blocks reachable from there.
 */
function sanitizeForReader(acc: Record<string, TEditorBlock>): Record<string, TEditorBlock> | null {
  if (!acc.root) return null;
  const sanitized: Record<string, TEditorBlock> = {};
  const queue: string[] = ['root'];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    const block = acc[id];
    if (!block) continue;
    seen.add(id);
    const ids = extractChildrenIds(block);
    const kept = ids.filter((cid) => Boolean(acc[cid]));
    if (kept.length !== ids.length) {
      const data = block.data as {
        childrenIds?: string[];
        props?: { childrenIds?: string[] };
      };
      // Preserve the nesting level the block originally used.
      if (Array.isArray(data.childrenIds)) {
        sanitized[id] = { ...block, data: { ...data, childrenIds: kept } } as TEditorBlock;
      } else if (data.props && Array.isArray(data.props.childrenIds)) {
        sanitized[id] = {
          ...block,
          data: { ...data, props: { ...data.props, childrenIds: kept } },
        } as TEditorBlock;
      } else {
        sanitized[id] = block;
      }
    } else {
      sanitized[id] = block;
    }
    for (const cid of kept) queue.push(cid);
  }
  return sanitized;
}

/**
 * Last-ditch error boundary around `Reader`. While we sanitise the document
 * before handing it to Reader, an exotic schema mismatch (e.g. a block whose
 * props fail `ReaderBlockSchema` runtime parse) could still throw. We catch
 * and show a placeholder instead of crashing the whole dialog.
 */
class ReaderErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    // Intentional no-op: the parser/panel already surfaces the raw frames.
  }
  componentDidUpdate(prevProps: { children: React.ReactNode }) {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export default function AIPreviewPanel({ response, onComplete, onError }: AIPreviewPanelProps) {
  const { t } = useTranslation('inspector');
  const theme = useTheme();

  const [acc, setAcc] = useState<Record<string, TEditorBlock>>({});
  const [frames, setFrames] = useState<NDJSONEvent[]>([]);
  const [bytes, setBytes] = useState(0);
  const [blockCount, setBlockCount] = useState(0);
  const [streamFinished, setStreamFinished] = useState(false);

  const accRef = useRef<Record<string, TEditorBlock>>({});
  // Tracks `id` values that appear more than once during the stream. The
  // backend now drops duplicates server-side (action: 'dropped'), so these
  // should normally be empty. Kept as a client-side safety net.
  const duplicateIdsRef = useRef<Set<string>>(new Set());
  // Human-readable strings built from `event: error` frames that arrive
  // mid-stream (e.g. malformed lines from the LLM). Collected instead of
  // aborting so the dialog keeps the raw NDJSON log visible for debugging
  // and the user can still Apply whatever partial document did assemble.
  const streamErrorsRef = useRef<string[]>([]);
  // Same pattern for `event: warning` frames (e.g. the backend dropped a
  // duplicate id for us).
  const streamWarningsRef = useRef<string[]>([]);
  const framesLogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Synchronous TEditorConfiguration → skip parsing, apply immediately.
    if (!isStreamingResponse(response)) {
      const document = response as TEditorConfiguration;
      accRef.current = document as unknown as Record<string, TEditorBlock>;
      setAcc(accRef.current);
      setBlockCount(Object.keys(accRef.current).length);
      setStreamFinished(true);
      onComplete(document, { duplicateIds: [], streamErrors: [], streamWarnings: [] });
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        for await (const event of parseNDJSONStream(response)) {
          if (cancelled) return;
          setBytes((b) => b + event.bytes);
          setFrames((fs) => [...fs, event]);
          switch (event.kind) {
            case 'block': {
              // Late emissions with an already-seen id silently overwrite
              // the earlier block in `acc`. Record the id so the dialog can
              // surface it as a validation error at `[DONE]`.
              if (event.id in accRef.current) {
                duplicateIdsRef.current.add(event.id);
              }
              accRef.current = { ...accRef.current, [event.id]: event.block };
              setAcc(accRef.current);
              setBlockCount((n) => n + 1);
              break;
            }
            case 'done': {
              setStreamFinished(true);
              // Auto-repair the accumulated document before handing it off:
              //   1. Normalize misplaced `props` into `data.props`.
              //   2. Strip dangling child references (LLM listed an id it
              //      never emitted).
              //   3. Reattach orphaned subtrees to root.childrenIds (LLM
              //      emitted blocks late and forgot to reference them).
              // All three are common LLM failure modes. We surface each as
              // a yellow warning so the user knows auto-repair fired.
              const rawDoc = accRef.current as unknown as TEditorConfiguration;
              const {
                repaired,
                appendedRootChildren,
                droppedReferences,
                normalizedBlocks,
                duplicateChildRefs,
              } = repairDocument(rawDoc);
              const touched =
                appendedRootChildren.length > 0 ||
                droppedReferences.length > 0 ||
                normalizedBlocks.length > 0 ||
                duplicateChildRefs.length > 0;
              if (touched) {
                accRef.current = repaired as unknown as Record<string, TEditorBlock>;
                setAcc(accRef.current);
              }
              for (const id of normalizedBlocks) {
                streamWarningsRef.current.push(
                  `Normalized block "${id}" shape: moved misplaced \`props\` into \`data.props\``,
                );
              }
              for (const { childId, keptBy, droppedFrom } of duplicateChildRefs) {
                streamWarningsRef.current.push(
                  `Removed duplicate child reference: "${childId}" appeared in both "${keptBy}" and "${droppedFrom}"; kept under "${keptBy}" to avoid double-rendering`,
                );
              }
              for (const { parent, missingId } of droppedReferences) {
                streamWarningsRef.current.push(
                  `Dropped dangling child reference: "${parent}" → "${missingId}" (block never emitted; removed from childrenIds)`,
                );
              }
              if (appendedRootChildren.length > 0) {
                streamWarningsRef.current.push(
                  `Auto-attached ${appendedRootChildren.length} orphaned block(s) to the root layout: ${appendedRootChildren.join(', ')}`,
                );
              }
              onComplete(repaired, {
                duplicateIds: Array.from(duplicateIdsRef.current),
                streamErrors: [...streamErrorsRef.current],
                streamWarnings: [...streamWarningsRef.current],
              });
              return;
            }
            case 'error': {
              // Non-fatal: record the message and keep reading so the user
              // still sees the raw NDJSON log and any blocks that did make
              // it through. Catastrophic errors are handled by the catch
              // block below via `onError`.
              const message = formatPayloadMessage(event.payload);
              streamErrorsRef.current.push(message);
              break;
            }
            case 'warning': {
              // e.g. backend dedup for duplicate ids. Track and keep going.
              const message = formatPayloadMessage(event.payload);
              streamWarningsRef.current.push(message);
              break;
            }
            case 'malformed': {
              // Already added to the raw frames log above; keep streaming.
              break;
            }
            case 'info': {
              // Metadata frame (image_pool, etc.). Already in the frames log
              // for diagnostics. No user-facing surface for now.
              break;
            }
          }
        }
        // Stream ended without a [DONE] terminator.
        if (!cancelled) {
          setStreamFinished(true);
          if (accRef.current.root) {
            const rawDoc = accRef.current as unknown as TEditorConfiguration;
            const {
              repaired,
              appendedRootChildren,
              droppedReferences,
              normalizedBlocks,
              duplicateChildRefs,
            } = repairDocument(rawDoc);
            const touched =
              appendedRootChildren.length > 0 ||
              droppedReferences.length > 0 ||
              normalizedBlocks.length > 0 ||
              duplicateChildRefs.length > 0;
            if (touched) {
              accRef.current = repaired as unknown as Record<string, TEditorBlock>;
              setAcc(accRef.current);
            }
            for (const id of normalizedBlocks) {
              streamWarningsRef.current.push(
                `Normalized block "${id}" shape: moved misplaced \`props\` into \`data.props\``,
              );
            }
            for (const { childId, keptBy, droppedFrom } of duplicateChildRefs) {
              streamWarningsRef.current.push(
                `Removed duplicate child reference: "${childId}" appeared in both "${keptBy}" and "${droppedFrom}"; kept under "${keptBy}" to avoid double-rendering`,
              );
            }
            for (const { parent, missingId } of droppedReferences) {
              streamWarningsRef.current.push(
                `Dropped dangling child reference: "${parent}" → "${missingId}" (block never emitted; removed from childrenIds)`,
              );
            }
            if (appendedRootChildren.length > 0) {
              streamWarningsRef.current.push(
                `Auto-attached ${appendedRootChildren.length} orphaned block(s) to the root layout: ${appendedRootChildren.join(', ')}`,
              );
            }
            onComplete(repaired, {
              duplicateIds: Array.from(duplicateIdsRef.current),
              streamErrors: [...streamErrorsRef.current],
              streamWarnings: [...streamWarningsRef.current],
            });
          } else {
            onError('Stream ended before any block was received');
          }
        }
      } catch (err) {
        if (cancelled) return;
        setStreamFinished(true);
        // AbortError-style rejections propagate here when the parent dialog
        // aborts mid-stream. Let the dialog own the user-facing message.
        onError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
    };
    // Re-run only when the response changes. onComplete/onError are captured
    // once at mount; the dialog wraps them in stable useCallback references.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  // Auto-scroll the raw frames log to the bottom as new frames arrive.
  useEffect(() => {
    const el = framesLogRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [frames.length]);

  const sanitized = useMemo(() => sanitizeForReader(acc), [acc]);

  return (
    <Stack sx={{ gap: 1.5 }}>
      {/* Stream stats — hidden (unhide by removing display:'none') */}
      <Box sx={{ display: 'none' }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}
        >
          <Typography variant="caption" color="text.secondary">
            {t('aiGeneration.preview.blocksCount', { count: blockCount })}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('aiGeneration.preview.bytesCount', { bytes })}
          </Typography>
        </Stack>
        <LinearProgress
          variant={streamFinished ? 'determinate' : 'indeterminate'}
          value={streamFinished ? 100 : undefined}
          sx={{ borderRadius: '4px', height: 4 }}
        />
      </Box>
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, minHeight: 320 }}>
        {/* Raw frames log — hidden (unhide by removing display:'none') */}
        <Box sx={{ flex: 1, display: 'none', flexDirection: 'column', minWidth: 0 }}>
          <Typography sx={{ fontSize: '14px', fontWeight: 700, mb: 0.5 }}>
            {t('aiGeneration.preview.framesTitle')}
          </Typography>
          <Box
            ref={framesLogRef}
            sx={{
              flex: 1,
              minHeight: 240,
              maxHeight: 360,
              overflow: 'auto',
              p: 1,
              borderRadius: '8px',
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.default,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: '12px',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {frames.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'inherit' }}>
                {t('aiGeneration.preview.emptyFrames')}
              </Typography>
            ) : (
              frames.map((frame, i) => {
                const isError = frame.kind === 'error' || frame.kind === 'malformed';
                const isWarning = frame.kind === 'warning';
                return (
                  <Box
                    key={i}
                    sx={{
                      color: isError
                        ? theme.palette.error.main
                        : isWarning
                          ? theme.palette.warning.main
                          : 'inherit',
                      mb: 0.5,
                    }}
                  >
                    {frame.raw}
                  </Box>
                );
              })
            )}
            {!streamFinished && frames.length > 0 && (
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  width: 8,
                  height: 14,
                  verticalAlign: 'middle',
                  backgroundColor: theme.palette.primary.main,
                  animation: 'ai-preview-cursor-blink 1s steps(2, start) infinite',
                  '@keyframes ai-preview-cursor-blink': {
                    '0%, 50%': { opacity: 1 },
                    '50.01%, 100%': { opacity: 0 },
                  },
                }}
              />
            )}
          </Box>
        </Box>

        {/* Live preview */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Stack
            direction="row"
            sx={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 0.5 }}
          >
            <Typography sx={{ fontSize: '14px', fontWeight: 700 }}>
              {t('aiGeneration.preview.previewTitle')}
            </Typography>
            {!streamFinished && (
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                {t('aiGeneration.dialog.status.streaming')}
                {blockCount > 0
                  ? ` · ${t('aiGeneration.preview.blocksCount', { count: blockCount })}`
                  : ''}
              </Typography>
            )}
          </Stack>
          {/* Streaming is otherwise only visible as blocks appearing; the bar
              says "still working" during quiet gaps between frames. */}
          {!streamFinished && <LinearProgress sx={{ borderRadius: '2px', height: 3, mb: 0.5 }} />}
          <Box
            sx={{
              flex: 1,
              minHeight: 240,
              maxHeight: 360,
              overflow: 'auto',
              borderRadius: '8px',
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.canvas ?? theme.palette.background.default,
            }}
          >
            {sanitized ? (
              <ReaderErrorBoundary
                fallback={
                  <Box sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('aiGeneration.preview.renderError')}
                    </Typography>
                  </Box>
                }
              >
                <EditorRenderContextBridge>
                  <Reader document={sanitized as unknown as TReaderDocument} rootBlockId="root" />
                </EditorRenderContextBridge>
              </ReaderErrorBoundary>
            ) : (
              <Box
                sx={{
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {t('aiGeneration.preview.emptyPreview')}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Stack>
    </Stack>
  );
}
