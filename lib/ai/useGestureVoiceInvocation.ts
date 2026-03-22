'use client';

import * as React from 'react';

import type { VoiceAgentSessionController } from '@/lib/ai/useVoiceAgentSession';
import type { GestureEngineFrame, LocalGestureEvent } from '@/lib/gesture/types';

const GESTURE_VOICE_COOLDOWN_MS = 1600;

export type GestureVoiceInvocationState = {
  cooldownRemainingMs: number;
  isCoolingDown: boolean;
  lastAction: 'start' | 'stop' | null;
  lastActionAt: number | null;
};

export function shouldHandleGestureVoiceEvent(args: {
  event: LocalGestureEvent;
  isSessionActive: boolean;
  now: number;
  lastActionAt: number;
}) {
  if (args.now - args.lastActionAt < GESTURE_VOICE_COOLDOWN_MS) {
    return false;
  }

  if (args.event.type !== 'GESTURE_ACTION_EMITTED') {
    return false;
  }

  if (args.event.payload.action === 'ACTIVATE_AI_LISTENING') {
    return !args.isSessionActive;
  }

  if (args.event.payload.action === 'EXIT_MODE') {
    return args.isSessionActive;
  }

  return false;
}

export function useGestureVoiceInvocation({
  frame,
  session,
}: {
  frame: GestureEngineFrame | null;
  session: Pick<VoiceAgentSessionController, 'isSessionActive' | 'start' | 'stop'>;
}) {
  const lastHandledActionAtRef = React.useRef(-Infinity);
  const lastHandledTimestampRef = React.useRef<number | null>(null);
  const [state, setState] = React.useState<GestureVoiceInvocationState>({
    cooldownRemainingMs: 0,
    isCoolingDown: false,
    lastAction: null,
    lastActionAt: null,
  });

  React.useEffect(() => {
    if (!frame?.events.length) {
      return;
    }

    if (lastHandledTimestampRef.current === frame.timestamp) {
      return;
    }

    lastHandledTimestampRef.current = frame.timestamp;

    for (const event of frame.events) {
      if (event.type !== 'GESTURE_ACTION_EMITTED') {
        continue;
      }

      if (
        !shouldHandleGestureVoiceEvent({
          event,
          isSessionActive: session.isSessionActive,
          now: frame.timestamp,
          lastActionAt: lastHandledActionAtRef.current,
        })
      ) {
        continue;
      }

      lastHandledActionAtRef.current = frame.timestamp;

      if (event.payload.action === 'ACTIVATE_AI_LISTENING') {
        void session.start('gesture');
        setState({
          cooldownRemainingMs: GESTURE_VOICE_COOLDOWN_MS,
          isCoolingDown: true,
          lastAction: 'start',
          lastActionAt: Date.now(),
        });
      } else if (event.payload.action === 'EXIT_MODE') {
        session.stop('gesture');
        setState({
          cooldownRemainingMs: GESTURE_VOICE_COOLDOWN_MS,
          isCoolingDown: true,
          lastAction: 'stop',
          lastActionAt: Date.now(),
        });
      }

      break;
    }
  }, [frame, session]);

  React.useEffect(() => {
    const lastActionAt = state.lastActionAt;

    if (!lastActionAt) {
      return;
    }

    const interval = window.setInterval(() => {
      const remaining = Math.max(
        0,
        GESTURE_VOICE_COOLDOWN_MS - (Date.now() - lastActionAt),
      );

      setState((current) => ({
        ...current,
        cooldownRemainingMs: remaining,
        isCoolingDown: remaining > 0,
      }));

      if (remaining === 0) {
        window.clearInterval(interval);
      }
    }, 150);

    return () => {
      window.clearInterval(interval);
    };
  }, [state.lastActionAt]);

  return state;
}
