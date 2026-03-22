'use client';

import { createAudioCapture } from '@/lib/ai/client/audioCapture';
import { createAudioPlayback } from '@/lib/ai/client/audioPlayback';
import type { MeetVoiceEvent, VoiceSessionState } from '@/lib/ai/types';

type CreateVoiceSessionOptions = {
  onEvent: (event: MeetVoiceEvent) => void;
  onStateChange?: (state: VoiceSessionState, detail?: string) => void;
  roomName: string;
  wsUrl?: string;
};

function createSessionId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `voice-${Date.now()}`;
}

function resolveVoiceAgentUrl(explicitUrl: string | undefined, roomName: string, sessionId: string) {
  const base =
    explicitUrl ??
    process.env.NEXT_PUBLIC_VOICE_AGENT_WS_URL ??
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8787/ws`;

  const url = new URL(base);
  url.searchParams.set('roomName', roomName);
  url.searchParams.set('sessionId', sessionId);
  return url.toString();
}

export function createVoiceSession(options: CreateVoiceSessionOptions) {
  const audioCapture = createAudioCapture();
  const audioPlayback = createAudioPlayback();
  let socket: WebSocket | null = null;
  let activeSessionId: string | null = null;
  let ttsFinishTimeout: ReturnType<typeof setTimeout> | null = null;
  let turnLocked = false;

  const setState = (state: VoiceSessionState, detail?: string) => {
    console.log('[meet/voice] state', {
      roomName: options.roomName,
      state,
      detail,
    });
    options.onStateChange?.(state, detail);
  };

  function cleanupSocket() {
    if (!socket) {
      return;
    }

    socket.close();
    socket = null;
  }

  function stopCapture() {
    audioCapture.stop();
  }

  function finalizeTurn() {
    stopCapture();
    cleanupSocket();
    turnLocked = false;
    activeSessionId = null;
    setState('idle');
  }

  function stop() {
    if (ttsFinishTimeout) {
      clearTimeout(ttsFinishTimeout);
      ttsFinishTimeout = null;
    }

    audioPlayback.stop();
    finalizeTurn();
  }

  function handleEvent(event: MeetVoiceEvent) {
    options.onEvent(event);

    switch (event.type) {
      case 'stt_chunk':
        setState('listening');
        break;
      case 'stt_output':
        turnLocked = true;
        stopCapture();
        setState('thinking');
        audioPlayback.resetScheduling();
        break;
      case 'agent_chunk':
        break;
      case 'tts_chunk':
        if (ttsFinishTimeout) {
          clearTimeout(ttsFinishTimeout);
          ttsFinishTimeout = null;
        }

        if (audioPlayback.getPendingPlaybackMs() === 0) {
          setState('speaking');
        }

        audioPlayback.push(event.audio);
        break;
      case 'tts_end':
        setState('speaking');
        if (ttsFinishTimeout) {
          clearTimeout(ttsFinishTimeout);
        }
        ttsFinishTimeout = setTimeout(() => {
          finalizeTurn();
        }, Math.max(150, audioPlayback.getPendingPlaybackMs() + 150));
        break;
      case 'error':
        turnLocked = false;
        setState('error', event.message);
        break;
      default:
        break;
    }
  }

  return {
    async start() {
      if (activeSessionId) {
        return false;
      }

      const sessionId = createSessionId();
      activeSessionId = sessionId;
      turnLocked = false;
      setState('connecting');

      const wsUrl = resolveVoiceAgentUrl(options.wsUrl, options.roomName, sessionId);
      console.log('[meet/voice] opening websocket', {
        roomName: options.roomName,
        sessionId,
        wsUrl,
      });
      socket = new WebSocket(wsUrl);
      socket.binaryType = 'arraybuffer';

      socket.onopen = async () => {
        console.log('[meet/voice] websocket open', {
          roomName: options.roomName,
          sessionId,
        });
        try {
          let sentChunkCount = 0;
          await audioCapture.start((chunk) => {
            if (socket?.readyState === WebSocket.OPEN) {
              sentChunkCount += 1;
              if (sentChunkCount <= 3) {
                console.log('[meet/voice] websocket sent chunk', {
                  roomName: options.roomName,
                  sessionId,
                  bytes: chunk.byteLength,
                  sentChunkCount,
                });
              }
              socket.send(chunk);
            }
          });
          setState('listening');
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unable to access microphone capture.';
          setState('error', message);
          stop();
        }
      };

      socket.onmessage = (message) => {
        const event = JSON.parse(String(message.data)) as MeetVoiceEvent;
        console.log('[meet/voice] event', {
          roomName: options.roomName,
          sessionId,
          type: event.type,
        });
        handleEvent(event);
      };

      socket.onerror = () => {
        setState('error', 'Voice transport encountered a WebSocket error.');
      };

      socket.onclose = () => {
        console.log('[meet/voice] websocket closed', {
          roomName: options.roomName,
          sessionId,
        });
        stopCapture();
        socket = null;
        if (activeSessionId) {
          setState('idle');
          activeSessionId = null;
        }
      };

      return true;
    },
    stop,
  };
}
