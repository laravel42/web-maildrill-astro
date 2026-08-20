import { useEffect, useRef, useState } from 'react';
import type { ApplicationCall, InfobipRTC } from 'infobip-rtc';
import { api, ApiError } from '@/lib/app/api';

/**
 * In-browser voice template preview with the REAL Infobip TTS voice.
 *
 * Infobip cannot synthesize TTS to a file — its voices only exist inside
 * calls. So: the backend mints a one-off WebRTC identity + token, this hook
 * connects the infobip-rtc SDK with it, the backend places a Calls-API call
 * to that identity and plays the text via `/say`. The hook answers the call
 * silently (listen-only, no microphone) and pipes the remote stream into an
 * <audio> element. Hanging up — from either side — ends playback.
 */

export type VoicePreviewState = 'idle' | 'connecting' | 'playing';

export type VoicePreviewArgs = {
  text: string;
  /** Infobip TTS language code for /say (e.g. "en", "pt-br", "zh-cn"). */
  language: string;
  /** Exact Infobip voice name, e.g. "Joanna" or "Ardi (neural)". */
  voiceName: string;
  speechRate: number;
};

const CONNECT_TIMEOUT_MS = 10_000;

function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 501 || err.message === 'voice_preview_not_configured') {
      return 'Voice preview isn’t configured yet — set INFOBIP_CALLS_CONFIGURATION_ID on the API.';
    }
    return err.message;
  }
  return err instanceof Error ? err.message : 'Voice preview failed.';
}

export function useVoicePreview() {
  const [state, setState] = useState<VoicePreviewState>('idle');
  const [error, setError] = useState<string | null>(null);

  const rtcRef = useRef<InfobipRTC | null>(null);
  const callRef = useRef<ApplicationCall | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** Bumped on every teardown so stale async callbacks become no-ops. */
  const epochRef = useRef(0);

  const teardown = () => {
    epochRef.current += 1;
    try {
      callRef.current?.hangup();
    } catch {
      /* already finished */
    }
    try {
      rtcRef.current?.disconnect();
    } catch {
      /* never connected */
    }
    callRef.current = null;
    rtcRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    setState('idle');
  };

  const stop = () => teardown();

  const play = async (args: VoicePreviewArgs) => {
    if (state !== 'idle') return;
    setError(null);
    setState('connecting');
    const epoch = epochRef.current;
    const live = () => epochRef.current === epoch;

    // Prime the audio element inside the click's user activation so the
    // browser's autoplay policy lets the remote stream play a few seconds
    // later, once the call is established.
    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    audio.autoplay = true;
    void audio.play().catch(() => {
      /* empty element — expected */
    });

    try {
      const session = await api.post<{ identity: string; token: string }>('voice/preview/session');
      if (!live()) return;

      const { createInfobipRtc, InfobipRTCEvent, CallsApiEvent, ApplicationCallOptions } =
        await import('infobip-rtc');
      if (!live()) return;

      const rtc = createInfobipRtc(session.token, { debug: false });
      rtcRef.current = rtc;

      rtc.on(InfobipRTCEvent.INCOMING_APPLICATION_CALL, (event) => {
        if (!live()) return;
        const call = event.incomingCall;
        callRef.current = call;
        call.on(CallsApiEvent.ESTABLISHED, (established) => {
          if (!live()) return;
          audio.srcObject = established.stream;
          void audio.play().catch(() => {
            setError('The browser blocked audio playback — press play again.');
          });
          setState('playing');
        });
        call.on(CallsApiEvent.HANGUP, () => {
          if (live()) teardown();
        });
        call.on(CallsApiEvent.ERROR, () => {
          if (!live()) return;
          setError('The preview call failed.');
          teardown();
        });
        // Listen-only: no local audio, so no microphone permission prompt.
        call.accept(ApplicationCallOptions.builder().setAudio(false).build());
      });

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Timed out connecting to Infobip WebRTC.')),
          CONNECT_TIMEOUT_MS,
        );
        rtc.on(InfobipRTCEvent.CONNECTED, () => {
          clearTimeout(timer);
          resolve();
        });
        rtc.on(InfobipRTCEvent.DISCONNECTED, () => {
          clearTimeout(timer);
          reject(new Error('Disconnected from Infobip WebRTC.'));
        });
        rtc.connect();
      });
      if (!live()) return;

      // Backend rings our identity, waits for the silent answer, then /say-s
      // the text with the selected voice. Playback starts on ESTABLISHED.
      await api.post('voice/preview/play', { identity: session.identity, ...args });
    } catch (err) {
      if (!live()) return;
      setError(friendlyError(err));
      teardown();
    }
  };

  // Never leave a call or socket behind when the composer unmounts.
  useEffect(() => {
    return () => {
      try {
        callRef.current?.hangup();
        rtcRef.current?.disconnect();
      } catch {
        /* best-effort cleanup */
      }
    };
  }, []);

  return { state, error, play, stop };
}
