import { describe, expect, it } from 'vitest';

import {
  applyHighlightStroke,
  clearHighlightSurface,
  createInitialHighlightSceneState,
  mergeHighlightSnapshot,
  removeHighlightStroke,
} from './store';

describe('highlight store', () => {
  it('keeps stroke ordering for a surface', () => {
    const initial = createInitialHighlightSceneState();
    const withFirst = applyHighlightStroke(initial, {
      id: 'stroke-1',
      kind: 'rect',
      screenShareId: 'screen-1',
      x: 0.1,
      y: 0.1,
      width: 0.2,
      height: 0.2,
      color: 'yellow',
      createdAt: '2026-03-20T10:00:00.000Z',
      createdBy: 'alice',
    });
    const withSecond = applyHighlightStroke(withFirst, {
      id: 'stroke-2',
      kind: 'rect',
      screenShareId: 'screen-1',
      x: 0.4,
      y: 0.3,
      width: 0.2,
      height: 0.2,
      color: 'yellow',
      createdAt: '2026-03-20T10:00:01.000Z',
      createdBy: 'alice',
    });

    expect(withSecond.surfaces['screen-1']?.order).toEqual(['stroke-1', 'stroke-2']);
  });

  it('drops pre-clear strokes when an older add arrives late', () => {
    const initial = createInitialHighlightSceneState();
    const cleared = clearHighlightSurface(initial, {
      screenShareId: 'screen-1',
      clearedAt: '2026-03-20T10:00:05.000Z',
      clearedBy: 'alice',
    });
    const afterLateStroke = applyHighlightStroke(cleared, {
      id: 'stroke-1',
      kind: 'rect',
      screenShareId: 'screen-1',
      x: 0.2,
      y: 0.2,
      width: 0.2,
      height: 0.2,
      color: 'yellow',
      createdAt: '2026-03-20T10:00:04.000Z',
      createdBy: 'bob',
    });

    expect(afterLateStroke.surfaces['screen-1']?.order).toEqual([]);
  });

  it('accepts a newer snapshot for late join sync', () => {
    const initial = createInitialHighlightSceneState();
    const merged = mergeHighlightSnapshot(initial, {
      sceneVersion: 4,
      surfaces: {
        'screen-1': {
          rects: {
            'stroke-1': {
              id: 'stroke-1',
              kind: 'rect',
              screenShareId: 'screen-1',
              x: 0.1,
              y: 0.1,
              width: 0.2,
              height: 0.2,
              color: 'yellow',
              createdAt: '2026-03-20T10:00:00.000Z',
              createdBy: 'alice',
            },
          },
          order: ['stroke-1'],
          lastClearedAt: null,
          lastClearedBy: null,
        },
      },
    });

    expect(merged.sceneVersion).toBe(4);
    expect(merged.surfaces['screen-1']?.order).toEqual(['stroke-1']);
  });

  it('removes only the targeted stroke', () => {
    const initial = createInitialHighlightSceneState();
    const withFirst = applyHighlightStroke(initial, {
      id: 'stroke-1',
      kind: 'rect',
      screenShareId: 'screen-1',
      x: 0.1,
      y: 0.1,
      width: 0.2,
      height: 0.2,
      color: 'yellow',
      createdAt: '2026-03-20T10:00:00.000Z',
      createdBy: 'alice',
    });
    const withSecond = applyHighlightStroke(withFirst, {
      id: 'stroke-2',
      kind: 'line',
      screenShareId: 'screen-1',
      x1: 0.5,
      y1: 0.5,
      x2: 0.7,
      y2: 0.6,
      thickness: 0.03,
      color: 'yellow',
      createdAt: '2026-03-20T10:00:01.000Z',
      createdBy: 'alice',
    });

    const next = removeHighlightStroke(withSecond, {
      screenShareId: 'screen-1',
      strokeId: 'stroke-2',
      removedAt: '2026-03-20T10:00:02.000Z',
      removedBy: 'alice',
    });

    expect(next.surfaces['screen-1']?.order).toEqual(['stroke-1']);
    expect(next.surfaces['screen-1']?.rects['stroke-2']).toBeUndefined();
  });
});
