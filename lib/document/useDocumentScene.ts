'use client';

import * as React from 'react';

import {
  createEmptyLocalDocumentSceneStore,
  type LocalDocumentSceneStore,
} from './scene-store';
import type { DocumentScenePatchEnvelope } from './patches';
import type { SceneMode } from './types';

const MIN_SCALE = 0.3;
const MAX_SCALE = 2.4;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export type UseDocumentSceneResult = {
  scene: ReturnType<LocalDocumentSceneStore['getState']>;
  applyPatch: (patch: DocumentScenePatchEnvelope) => void;
  setMode: (mode: SceneMode) => void;
  selectDocument: () => void;
  selectAnnotation: (annotationId: string) => void;
  clearSelection: () => void;
  moveDocumentTo: (next: { x: number; y: number }) => void;
  zoomDocumentTo: (scale: number) => void;
  resetDocument: () => void;
};

export function useDocumentScene(roomName = 'local-room'): UseDocumentSceneResult {
  const storeRef = React.useRef<LocalDocumentSceneStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createEmptyLocalDocumentSceneStore(roomName);
  }

  const store = storeRef.current;
  const scene = React.useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState,
  );

  const applyPatch = React.useCallback(
    (patch: DocumentScenePatchEnvelope) => {
      store.applyPatch(patch);
    },
    [store],
  );

  const setMode = React.useCallback(
    (mode: SceneMode) => {
      applyPatch({
        entityType: 'mode',
        entityId: 'mode',
        operation: 'replace',
        patch: { active: mode },
      });
    },
    [applyPatch],
  );

  const selectDocument = React.useCallback(() => {
    const document = store.getState().document;
    if (!document) {
      return;
    }

    applyPatch({
      entityType: 'selection',
      entityId: 'selection',
      operation: 'replace',
      patch: {
        entityType: 'document',
        entityId: document.id,
      },
    });
  }, [applyPatch, store]);

  const selectAnnotation = React.useCallback(
    (annotationId: string) => {
      applyPatch({
        entityType: 'selection',
        entityId: 'selection',
        operation: 'replace',
        patch: {
          entityType: 'annotation',
          entityId: annotationId,
        },
      });
    },
    [applyPatch],
  );

  const clearSelection = React.useCallback(() => {
    applyPatch({
      entityType: 'selection',
      entityId: 'selection',
      operation: 'remove',
      patch: {
        entityType: null,
        entityId: null,
      },
    });
  }, [applyPatch]);

  const moveDocumentTo = React.useCallback(
    (next: { x: number; y: number }) => {
      const currentDocument = store.getState().document;
      if (!currentDocument) {
        return;
      }

      applyPatch({
        entityType: 'document',
        entityId: currentDocument.id,
        operation: 'move',
        patch: next,
      });
    },
    [applyPatch, store],
  );

  const zoomDocumentTo = React.useCallback(
    (scale: number) => {
      const currentDocument = store.getState().document;
      if (!currentDocument) {
        return;
      }

      applyPatch({
        entityType: 'document',
        entityId: currentDocument.id,
        operation: 'resize',
        patch: {
          scale: clamp(scale, MIN_SCALE, MAX_SCALE),
        },
      });
    },
    [applyPatch, store],
  );

  const resetDocument = React.useCallback(() => {
    const currentDocument = store.getState().document;
    if (!currentDocument) {
      return;
    }

    store.applyPatches([
      {
        entityType: 'document',
        entityId: currentDocument.id,
        operation: 'replace',
        patch: {
          x: 20,
          y: 24,
          scale: 0.56,
        },
      },
      {
        entityType: 'selection',
        entityId: 'selection',
        operation: 'replace',
        patch: {
          entityType: 'document',
          entityId: currentDocument.id,
        },
      },
      {
        entityType: 'mode',
        entityId: 'mode',
        operation: 'replace',
        patch: {
          active: 'NAVIGATION',
        },
      },
    ]);
  }, [store]);

  return {
    scene,
    applyPatch,
    setMode,
    selectDocument,
    selectAnnotation,
    clearSelection,
    moveDocumentTo,
    zoomDocumentTo,
    resetDocument,
  };
}
