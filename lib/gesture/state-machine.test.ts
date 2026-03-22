import { describe, expect, it } from 'vitest';

import { createInitialGestureTrackerState, reduceGestureFrame } from './state-machine';
import type { ClassifiedHandPose } from './types';

function createPose(gesture: ClassifiedHandPose['gesture']): ClassifiedHandPose {
  return {
    hand: 'right',
    landmarks: [],
    center: { x: 0.5, y: 0.5 },
    gesture,
    confidence: 0.99,
    pinchDistance: 0.1,
    fingerStates: {
      thumb: false,
      index: false,
      middle: false,
      ring: false,
      pinky: false,
    },
  };
}

describe('gesture state machine', () => {
  it('starts in annotation mode', () => {
    const state = createInitialGestureTrackerState();

    const frame = reduceGestureFrame({
      poses: [],
      timestamp: 0,
      state,
    });

    expect(frame.mode).toBe('ANNOTATION_MODE');
  });

  it('activates ai listening from annotation mode on fist hold', () => {
    const state = createInitialGestureTrackerState();
    const pose = createPose('FIST');

    reduceGestureFrame({
      poses: [pose],
      timestamp: 0,
      state,
    });

    const frame = reduceGestureFrame({
      poses: [pose],
      timestamp: 1200,
      state,
    });

    expect(frame.mode).toBe('AI_LISTENING');
    expect(frame.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'GESTURE_ACTION_EMITTED',
          payload: expect.objectContaining({
            action: 'ACTIVATE_AI_LISTENING',
            mode: 'AI_LISTENING',
          }),
        }),
      ]),
    );
  });

  it('returns from ai listening to annotation mode on open palm hold', () => {
    const state = createInitialGestureTrackerState();
    const fist = createPose('FIST');
    const openPalm = createPose('OPEN_PALM');

    reduceGestureFrame({
      poses: [fist],
      timestamp: 0,
      state,
    });
    reduceGestureFrame({
      poses: [fist],
      timestamp: 1200,
      state,
    });

    reduceGestureFrame({
      poses: [openPalm],
      timestamp: 2200,
      state,
    });

    const frame = reduceGestureFrame({
      poses: [openPalm],
      timestamp: 3400,
      state,
    });

    expect(frame.mode).toBe('ANNOTATION_MODE');
    expect(frame.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'GESTURE_ACTION_EMITTED',
          payload: expect.objectContaining({
            action: 'EXIT_MODE',
            mode: 'ANNOTATION_MODE',
          }),
        }),
      ]),
    );
  });

  it('maps pinch and three fingers to drawing and erasing while in annotation mode', () => {
    const state = createInitialGestureTrackerState();

    const drawingFrame = reduceGestureFrame({
      poses: [createPose('PINCH')],
      timestamp: 500,
      state,
    });
    const erasingFrame = reduceGestureFrame({
      poses: [createPose('THREE_FINGERS')],
      timestamp: 1000,
      state,
    });

    expect(drawingFrame.mode).toBe('DRAWING');
    expect(erasingFrame.mode).toBe('ERASING');
  });
});
