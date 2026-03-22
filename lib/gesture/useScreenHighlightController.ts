'use client';

import * as React from 'react';

import type { GestureEngineFrame } from '@/lib/gesture/types';
import type { HighlightStroke } from '@/lib/highlight/types';

const DRAW_CONFIDENCE_THRESHOLD = 0.78;
const DRAW_INTERVAL_MS = 60;
const DRAW_DISTANCE_THRESHOLD = 0.012;
const ERASE_COOLDOWN_MS = 120;
const ERASER_RADIUS = 0.04;
const DEFAULT_LINE_THICKNESS = 0.04;
const SMOOTHING_FACTOR = 0.35;

type Point = {
  x: number;
  y: number;
};

export type ScreenHighlightControllerState = {
  status: 'idle' | 'annotation_ready' | 'drawing' | 'erasing' | 'ai_listening';
  targetSurfaceId: string | null;
  lastHighlightAt: number | null;
  lastEraseAt: number | null;
  pointer: Point | null;
};

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function smoothPoint(previous: Point | null, next: Point): Point {
  if (!previous) {
    return next;
  }

  return {
    x: previous.x + (next.x - previous.x) * SMOOTHING_FACTOR,
    y: previous.y + (next.y - previous.y) * SMOOTHING_FACTOR,
  };
}

export function distanceBetweenPoints(left: Point, right: Point) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function distanceFromPointToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return distanceBetweenPoints(point, start);
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );

  return distanceBetweenPoints(point, {
    x: start.x + t * dx,
    y: start.y + t * dy,
  });
}

export function findTouchedHighlightStrokeId(point: Point, strokes: HighlightStroke[]) {
  for (let index = strokes.length - 1; index >= 0; index -= 1) {
    const stroke = strokes[index];

    if (stroke.kind === 'rect') {
      const paddedX1 = stroke.x - ERASER_RADIUS / 2;
      const paddedY1 = stroke.y - ERASER_RADIUS / 2;
      const paddedX2 = stroke.x + stroke.width + ERASER_RADIUS / 2;
      const paddedY2 = stroke.y + stroke.height + ERASER_RADIUS / 2;

      if (
        point.x >= paddedX1 &&
        point.x <= paddedX2 &&
        point.y >= paddedY1 &&
        point.y <= paddedY2
      ) {
        return stroke.id;
      }

      continue;
    }

    if (
      distanceFromPointToSegment(
        point,
        { x: stroke.x1, y: stroke.y1 },
        { x: stroke.x2, y: stroke.y2 },
      ) <= Math.max(ERASER_RADIUS, stroke.thickness * 0.85)
    ) {
      return stroke.id;
    }
  }

  return null;
}

type ShouldEmitArgs = {
  frame: GestureEngineFrame;
  now: number;
  lastHighlightAt: number;
  lastHighlightPoint: Point | null;
  targetSurfaceId: string | null;
};

export function shouldEmitHighlightSample({
  frame,
  now,
  lastHighlightAt,
  lastHighlightPoint,
  targetSurfaceId,
}: ShouldEmitArgs) {
  if (!targetSurfaceId || !frame.primaryPose) {
    return false;
  }

  if (frame.mode !== 'DRAWING' || frame.stableGesture !== 'PINCH') {
    return false;
  }

  if (frame.confidence < DRAW_CONFIDENCE_THRESHOLD) {
    return false;
  }

  if (now - lastHighlightAt < DRAW_INTERVAL_MS) {
    return false;
  }

  if (
    lastHighlightPoint &&
    distanceBetweenPoints(lastHighlightPoint, {
      x: 1 - frame.primaryPose.center.x,
      y: frame.primaryPose.center.y,
    }) < DRAW_DISTANCE_THRESHOLD
  ) {
    return false;
  }

  return true;
}

type UseScreenHighlightControllerArgs = {
  frame: GestureEngineFrame | null;
  targetSurfaceId: string | null;
  addHighlight: (input: {
    id?: string;
    screenShareId: string;
    kind?: 'rect' | 'line';
    color?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    thickness?: number;
  }) => Promise<void>;
  strokes: HighlightStroke[];
  removeHighlight: (screenShareId: string, strokeId: string) => Promise<void>;
};

export function useScreenHighlightController({
  frame,
  targetSurfaceId,
  addHighlight,
  strokes,
  removeHighlight,
}: UseScreenHighlightControllerArgs) {
  const smoothedPointRef = React.useRef<Point | null>(null);
  const lastHighlightPointRef = React.useRef<Point | null>(null);
  const lastHighlightAtRef = React.useRef(-Infinity);
  const activeStrokeIdRef = React.useRef<string | null>(null);
  const activeStrokeStartRef = React.useRef<Point | null>(null);
  const lastEraseAtRef = React.useRef(-Infinity);
  const lastErasedStrokeIdRef = React.useRef<string | null>(null);
  const [state, setState] = React.useState<ScreenHighlightControllerState>({
    status: 'idle',
    targetSurfaceId,
    lastHighlightAt: null,
    lastEraseAt: null,
    pointer: null,
  });

  React.useEffect(() => {
    setState((current) =>
      current.targetSurfaceId === targetSurfaceId
        ? current
        : {
            ...current,
            targetSurfaceId,
          },
    );
  }, [targetSurfaceId]);

  React.useEffect(() => {
    if (!frame || !targetSurfaceId) {
      setState((current) => ({
        ...current,
        status: targetSurfaceId ? 'annotation_ready' : 'idle',
        pointer: null,
      }));
      lastErasedStrokeIdRef.current = null;
      activeStrokeIdRef.current = null;
      activeStrokeStartRef.current = null;
      return;
    }

    if (frame.mode === 'AI_LISTENING') {
      setState((current) => ({
        ...current,
        status: 'ai_listening',
        pointer: null,
      }));
      lastErasedStrokeIdRef.current = null;
      activeStrokeIdRef.current = null;
      activeStrokeStartRef.current = null;
      return;
    }

    if (!frame.primaryPose) {
      setState((current) => ({
        ...current,
        status: 'annotation_ready',
        pointer: null,
      }));
      lastErasedStrokeIdRef.current = null;
      activeStrokeIdRef.current = null;
      activeStrokeStartRef.current = null;
      return;
    }

    const now = frame.timestamp;
    const mirroredPoint = {
      x: 1 - frame.primaryPose.center.x,
      y: frame.primaryPose.center.y,
    };
    const smoothedPoint = smoothPoint(smoothedPointRef.current, mirroredPoint);
    smoothedPointRef.current = smoothedPoint;
    setState((current) => ({
      ...current,
      pointer: smoothedPoint,
    }));

    if (frame.mode === 'DRAWING' && frame.stableGesture === 'PINCH' && !activeStrokeIdRef.current) {
      activeStrokeIdRef.current =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `gesture-stroke-${Date.now()}`;
      activeStrokeStartRef.current = smoothedPoint;
    }

    if (
      shouldEmitHighlightSample({
        frame,
        now,
        lastHighlightAt: lastHighlightAtRef.current,
        lastHighlightPoint: lastHighlightPointRef.current,
        targetSurfaceId,
      })
    ) {
      const strokeId = activeStrokeIdRef.current;
      const strokeStart = activeStrokeStartRef.current ?? smoothedPoint;

      if (!strokeId) {
        return;
      }

      lastHighlightAtRef.current = now;
      lastHighlightPointRef.current = smoothedPoint;
      setState((current) => ({
        ...current,
        status: 'drawing',
        lastHighlightAt: now,
        pointer: smoothedPoint,
      }));
      void addHighlight({
        id: strokeId,
        screenShareId: targetSurfaceId,
        kind: 'line',
        color: 'rgba(255, 232, 120, 0.92)',
        x1: clampUnit(strokeStart.x),
        y1: clampUnit(strokeStart.y),
        x2: clampUnit(smoothedPoint.x),
        y2: clampUnit(smoothedPoint.y),
        thickness: DEFAULT_LINE_THICKNESS,
      });
      return;
    }

    if (frame.mode === 'ERASING' && frame.stableGesture === 'THREE_FINGERS') {
      const touchedStrokeId = findTouchedHighlightStrokeId(smoothedPoint, strokes);
      const canEraseAgain = now - lastEraseAtRef.current >= ERASE_COOLDOWN_MS;

      setState((current) => ({
        ...current,
        status: 'erasing',
        pointer: smoothedPoint,
        lastEraseAt: touchedStrokeId && canEraseAgain ? now : current.lastEraseAt,
      }));

      if (
        touchedStrokeId &&
        canEraseAgain &&
        touchedStrokeId !== lastErasedStrokeIdRef.current
      ) {
        lastEraseAtRef.current = now;
        lastErasedStrokeIdRef.current = touchedStrokeId;
        void removeHighlight(targetSurfaceId, touchedStrokeId);
      }

      return;
    }

    if (frame.stableGesture !== 'THREE_FINGERS' || frame.mode !== 'ERASING') {
      lastErasedStrokeIdRef.current = null;
    }

    if (frame.stableGesture !== 'PINCH' || frame.mode !== 'DRAWING') {
      activeStrokeIdRef.current = null;
      activeStrokeStartRef.current = null;
    }

    setState((current) => ({
      ...current,
      status: frame.mode === 'DRAWING' ? 'drawing' : 'annotation_ready',
      pointer: smoothedPoint,
    }));
  }, [addHighlight, frame, removeHighlight, strokes, targetSurfaceId]);

  return state;
}
