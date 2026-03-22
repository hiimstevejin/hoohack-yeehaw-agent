import { describe, expect, it } from 'vitest';

import {
  distanceBetweenPoints,
  findTouchedHighlightStrokeId,
  shouldEmitHighlightSample,
  smoothPoint,
} from './useScreenHighlightController';
import type { GestureEngineFrame } from './types';

function createFrame(overrides: Partial<GestureEngineFrame>): GestureEngineFrame {
  return {
    timestamp: 1000,
    stableGesture: 'PINCH',
    rawGesture: 'PINCH',
    confidence: 0.92,
    holdMs: 400,
    dominantHand: 'right',
    mode: 'DRAWING',
    handCount: 1,
    trackingActive: true,
    events: [],
    primaryPose: {
      hand: 'right',
      landmarks: [],
      center: { x: 0.25, y: 0.35 },
      gesture: 'PINCH',
      confidence: 0.92,
      pinchDistance: 0.01,
      fingerStates: {
        thumb: true,
        index: true,
        middle: false,
        ring: false,
        pinky: false,
      },
    },
    poses: [],
    ...overrides,
  };
}

describe('useScreenHighlightController helpers', () => {
  it('smooths points toward the next sample', () => {
    expect(smoothPoint({ x: 0.2, y: 0.2 }, { x: 0.6, y: 0.4 })).toEqual({
      x: 0.33999999999999997,
      y: 0.27,
    });
  });

  it('requires movement and cooldown before emitting a new highlight sample', () => {
    expect(
      shouldEmitHighlightSample({
        frame: createFrame({ timestamp: 1000 }),
        now: 1000,
        lastHighlightAt: 980,
        lastHighlightPoint: null,
        targetSurfaceId: 'surface-1',
      }),
    ).toBe(false);

    expect(
      shouldEmitHighlightSample({
        frame: createFrame({ timestamp: 1400 }),
        now: 1400,
        lastHighlightAt: 900,
        lastHighlightPoint: { x: 0.75, y: 0.35 },
        targetSurfaceId: 'surface-1',
      }),
    ).toBe(false);

    expect(
      shouldEmitHighlightSample({
        frame: createFrame({
          timestamp: 1400,
          primaryPose: {
            ...createFrame({}).primaryPose!,
            center: { x: 0.1, y: 0.7 },
          },
        }),
        now: 1400,
        lastHighlightAt: 900,
        lastHighlightPoint: { x: 0.76, y: 0.35 },
        targetSurfaceId: 'surface-1',
      }),
    ).toBe(true);
  });

  it('measures movement in normalized screen space', () => {
    expect(distanceBetweenPoints({ x: 0, y: 0 }, { x: 0.03, y: 0.04 })).toBeCloseTo(0.05);
  });

  it('finds the touched stroke under the eraser cursor', () => {
    expect(
      findTouchedHighlightStrokeId(
        { x: 0.5, y: 0.48 },
        [
          {
            id: 'rect-1',
            kind: 'rect',
            screenShareId: 'surface-1',
            x: 0.1,
            y: 0.1,
            width: 0.2,
            height: 0.2,
            color: 'yellow',
            createdAt: '2026-03-20T10:00:00.000Z',
            createdBy: 'alice',
          },
          {
            id: 'line-1',
            kind: 'line',
            screenShareId: 'surface-1',
            x1: 0.45,
            y1: 0.45,
            x2: 0.75,
            y2: 0.45,
            thickness: 0.04,
            color: 'yellow',
            createdAt: '2026-03-20T10:00:01.000Z',
            createdBy: 'alice',
          },
        ],
      ),
    ).toBe('line-1');
  });
});
