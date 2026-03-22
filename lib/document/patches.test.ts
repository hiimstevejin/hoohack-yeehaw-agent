import { describe, expect, it } from 'vitest';

import {
  applyDocumentScenePatch,
  applyDocumentScenePatches,
} from './patches';
import { createInitialDocumentSceneState } from './types';

describe('document scene patches', () => {
  it('applies deterministic document move and resize patches', () => {
    const initial = createInitialDocumentSceneState('phase-4-test');
    const patches = [
      {
        entityType: 'document' as const,
        entityId: 'placeholder-document',
        operation: 'move' as const,
        patch: { x: 132, y: 96 },
      },
      {
        entityType: 'document' as const,
        entityId: 'placeholder-document',
        operation: 'resize' as const,
        patch: { scale: 1.15 },
      },
    ];

    const firstRun = applyDocumentScenePatches(initial, patches);
    const secondRun = applyDocumentScenePatches(initial, patches);

    expect(firstRun).toEqual(secondRun);
    expect(firstRun.document?.transform).toEqual({
      x: 132,
      y: 96,
      scale: 1.15,
    });
    expect(firstRun.sceneVersion).toBe(2);
  });

  it('clears selection when the selected annotation is removed', () => {
    const initial = createInitialDocumentSceneState('phase-4-test');
    const selected = applyDocumentScenePatch(initial, {
      entityType: 'selection',
      entityId: 'selection',
      operation: 'replace',
      patch: {
        entityType: 'annotation',
        entityId: 'agenda',
      },
    });

    const next = applyDocumentScenePatch(selected, {
      entityType: 'annotation',
      entityId: 'agenda',
      operation: 'remove',
      patch: {},
    });

    expect(next.selection).toEqual({
      entityType: null,
      entityId: null,
    });
    expect(next.annotations.agenda).toBeUndefined();
  });
});
