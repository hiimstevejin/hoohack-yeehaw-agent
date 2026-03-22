import {
  applyDocumentScenePatch,
  applyDocumentScenePatches,
  type DocumentScenePatchEnvelope,
} from './patches';
import { createInitialDocumentSceneState, type DocumentSceneState } from './types';

type SceneListener = (scene: DocumentSceneState) => void;

export type LocalDocumentSceneStore = {
  getState: () => DocumentSceneState;
  replaceState: (nextState: DocumentSceneState) => DocumentSceneState;
  applyPatch: (patch: DocumentScenePatchEnvelope) => DocumentSceneState;
  applyPatches: (patches: DocumentScenePatchEnvelope[]) => DocumentSceneState;
  subscribe: (listener: SceneListener) => () => void;
};

export function createLocalDocumentSceneStore(
  initialState: DocumentSceneState,
): LocalDocumentSceneStore {
  let state = initialState;
  const listeners = new Set<SceneListener>();

  function publish() {
    listeners.forEach((listener) => {
      listener(state);
    });
  }

  return {
    getState() {
      return state;
    },
    replaceState(nextState) {
      state = nextState;
      publish();
      return state;
    },
    applyPatch(patch) {
      state = applyDocumentScenePatch(state, patch);
      publish();
      return state;
    },
    applyPatches(patches) {
      state = applyDocumentScenePatches(state, patches);
      publish();
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function createEmptyLocalDocumentSceneStore(roomName: string) {
  return createLocalDocumentSceneStore(createInitialDocumentSceneState(roomName));
}
