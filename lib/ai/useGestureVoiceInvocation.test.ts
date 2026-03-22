import { describe, expect, it } from 'vitest';

import { shouldHandleGestureVoiceEvent } from './useGestureVoiceInvocation';
import type { LocalGestureEvent } from '@/lib/gesture/types';

function createEvent(action: 'ACTIVATE_AI_LISTENING' | 'EXIT_MODE'): LocalGestureEvent {
  return {
    type: 'GESTURE_ACTION_EMITTED',
    payload: {
      action,
      mode: action === 'ACTIVATE_AI_LISTENING' ? 'AI_LISTENING' : 'ANNOTATION_MODE',
    },
  };
}

describe('useGestureVoiceInvocation helpers', () => {
  it('starts only when the session is idle and the gesture cooldown is clear', () => {
    expect(
      shouldHandleGestureVoiceEvent({
        event: createEvent('ACTIVATE_AI_LISTENING'),
        isSessionActive: false,
        now: 4000,
        lastActionAt: 0,
      }),
    ).toBe(true);

    expect(
      shouldHandleGestureVoiceEvent({
        event: createEvent('ACTIVATE_AI_LISTENING'),
        isSessionActive: true,
        now: 4000,
        lastActionAt: 0,
      }),
    ).toBe(false);
  });

  it('blocks duplicate gesture actions during cooldown', () => {
    expect(
      shouldHandleGestureVoiceEvent({
        event: createEvent('ACTIVATE_AI_LISTENING'),
        isSessionActive: false,
        now: 1200,
        lastActionAt: 0,
      }),
    ).toBe(false);
  });

  it('stops only when a gesture exit arrives during an active session', () => {
    expect(
      shouldHandleGestureVoiceEvent({
        event: createEvent('EXIT_MODE'),
        isSessionActive: true,
        now: 5000,
        lastActionAt: 0,
      }),
    ).toBe(true);

    expect(
      shouldHandleGestureVoiceEvent({
        event: createEvent('EXIT_MODE'),
        isSessionActive: false,
        now: 5000,
        lastActionAt: 0,
      }),
    ).toBe(false);
  });
});
