import type {
  HighlightClearPatch,
  HighlightRemovePatch,
  HighlightSceneSnapshot,
  HighlightSceneState,
  HighlightStroke,
  HighlightSurfaceState,
} from '@/lib/highlight/types';

function createEmptySurfaceState(): HighlightSurfaceState {
  return {
    rects: {},
    order: [],
    lastClearedAt: null,
    lastClearedBy: null,
  };
}

function getSurfaceState(state: HighlightSceneState, screenShareId: string): HighlightSurfaceState {
  return state.surfaces[screenShareId] ?? createEmptySurfaceState();
}

function compareIsoTimestamp(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

function shouldKeepStroke(surface: HighlightSurfaceState, stroke: HighlightStroke) {
  if (!surface.lastClearedAt) {
    return true;
  }

  return compareIsoTimestamp(stroke.createdAt, surface.lastClearedAt) > 0;
}

function sanitizeUnitInterval(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function sanitizeStroke(stroke: HighlightStroke): HighlightStroke {
  if (stroke.kind === 'line') {
    return {
      ...stroke,
      x1: sanitizeUnitInterval(stroke.x1),
      y1: sanitizeUnitInterval(stroke.y1),
      x2: sanitizeUnitInterval(stroke.x2),
      y2: sanitizeUnitInterval(stroke.y2),
      thickness: Math.max(0.01, Math.min(0.08, stroke.thickness)),
    };
  }

  const x1 = sanitizeUnitInterval(stroke.x);
  const y1 = sanitizeUnitInterval(stroke.y);
  const x2 = sanitizeUnitInterval(stroke.x + stroke.width);
  const y2 = sanitizeUnitInterval(stroke.y + stroke.height);

  return {
    ...stroke,
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.max(0.02, Math.abs(x2 - x1)),
    height: Math.max(0.02, Math.abs(y2 - y1)),
  };
}

export function createInitialHighlightSceneState(): HighlightSceneState {
  return {
    sceneVersion: 0,
    surfaces: {},
  };
}

export function applyHighlightStroke(
  state: HighlightSceneState,
  stroke: HighlightStroke,
  nextSceneVersion = state.sceneVersion + 1,
): HighlightSceneState {
  const normalizedStroke = sanitizeStroke(stroke);
  const currentSurface = getSurfaceState(state, normalizedStroke.screenShareId);

  if (!shouldKeepStroke(currentSurface, normalizedStroke)) {
    return {
      ...state,
      sceneVersion: nextSceneVersion,
    };
  }

  const nextOrder = currentSurface.order.includes(normalizedStroke.id)
    ? currentSurface.order
    : [...currentSurface.order, normalizedStroke.id];

  return {
    sceneVersion: nextSceneVersion,
    surfaces: {
      ...state.surfaces,
      [normalizedStroke.screenShareId]: {
        ...currentSurface,
        rects: {
          ...currentSurface.rects,
          [normalizedStroke.id]: normalizedStroke,
        },
        order: nextOrder,
      },
    },
  };
}

export function clearHighlightSurface(
  state: HighlightSceneState,
  patch: HighlightClearPatch,
  nextSceneVersion = state.sceneVersion + 1,
): HighlightSceneState {
  const currentSurface = getSurfaceState(state, patch.screenShareId);

  if (
    currentSurface.lastClearedAt &&
    compareIsoTimestamp(currentSurface.lastClearedAt, patch.clearedAt) >= 0
  ) {
    return {
      ...state,
      sceneVersion: nextSceneVersion,
    };
  }

  return {
    sceneVersion: nextSceneVersion,
    surfaces: {
      ...state.surfaces,
      [patch.screenShareId]: {
        rects: {},
        order: [],
        lastClearedAt: patch.clearedAt,
        lastClearedBy: patch.clearedBy,
      },
    },
  };
}

export function removeHighlightStroke(
  state: HighlightSceneState,
  patch: HighlightRemovePatch,
  nextSceneVersion = state.sceneVersion + 1,
): HighlightSceneState {
  const currentSurface = getSurfaceState(state, patch.screenShareId);

  if (!currentSurface.rects[patch.strokeId]) {
    return {
      ...state,
      sceneVersion: nextSceneVersion,
    };
  }

  const nextRects = { ...currentSurface.rects };
  delete nextRects[patch.strokeId];

  return {
    sceneVersion: nextSceneVersion,
    surfaces: {
      ...state.surfaces,
      [patch.screenShareId]: {
        ...currentSurface,
        rects: nextRects,
        order: currentSurface.order.filter((id) => id !== patch.strokeId),
      },
    },
  };
}

export function mergeHighlightSnapshot(
  state: HighlightSceneState,
  snapshot: HighlightSceneSnapshot,
): HighlightSceneState {
  if (snapshot.sceneVersion <= state.sceneVersion) {
    return state;
  }

  return {
    sceneVersion: snapshot.sceneVersion,
    surfaces: snapshot.surfaces,
  };
}

export function getHighlightRectsForSurface(
  state: HighlightSceneState,
  screenShareId: string,
) {
  const surface = state.surfaces[screenShareId];

  if (!surface) {
    return [];
  }

  return surface.order
    .map((id) => surface.rects[id])
    .filter((stroke): stroke is HighlightStroke => Boolean(stroke));
}
