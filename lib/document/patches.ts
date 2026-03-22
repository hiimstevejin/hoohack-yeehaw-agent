import {
  createAnnotationEntity,
  createDocumentEntity,
  type AnnotationSceneEntity,
  type DocumentSceneEntity,
  type DocumentSceneState,
  type SceneMode,
  type SelectionState,
} from './types';

export type ScenePatchOperation = 'set' | 'move' | 'resize' | 'replace' | 'remove';
export type ScenePatchEntityType = 'document' | 'annotation' | 'mode' | 'selection';

export type DocumentPatchValue = Partial<
  Pick<DocumentSceneEntity, 'title' | 'source' | 'page' | 'visible'> & {
    x: number;
    y: number;
    scale: number;
    width: number;
    height: number;
  }
>;

export type AnnotationPatchValue = Partial<
  Pick<AnnotationSceneEntity, 'label' | 'color' | 'visible'> & {
    x: number;
    y: number;
    width: number;
    height: number;
  }
>;

export type ModePatchValue = {
  active: SceneMode;
};

export type SelectionPatchValue = SelectionState;

export type DocumentScenePatch = {
  entityType: 'document';
  entityId: string;
  operation: ScenePatchOperation;
  patch: DocumentPatchValue;
};

export type AnnotationScenePatch = {
  entityType: 'annotation';
  entityId: string;
  operation: ScenePatchOperation;
  patch: AnnotationPatchValue;
};

export type ModeScenePatch = {
  entityType: 'mode';
  entityId: 'mode';
  operation: ScenePatchOperation;
  patch: ModePatchValue;
};

export type SelectionScenePatch = {
  entityType: 'selection';
  entityId: 'selection';
  operation: ScenePatchOperation;
  patch: SelectionPatchValue;
};

export type DocumentScenePatchEnvelope =
  | DocumentScenePatch
  | AnnotationScenePatch
  | ModeScenePatch
  | SelectionScenePatch;

function clearSelection(): SelectionState {
  return {
    entityType: null,
    entityId: null,
  };
}

function mergeDocumentEntity(
  current: DocumentSceneEntity | null,
  patch: DocumentScenePatch,
): DocumentSceneEntity {
  const base =
    current && current.id === patch.entityId
      ? current
      : createDocumentEntity({
          id: patch.entityId,
          title: typeof patch.patch.title === 'string' ? patch.patch.title : 'Untitled document',
          source: patch.patch.source ?? {
            kind: 'image',
            src: '/Placeholder.png',
            alt: 'Document placeholder',
          },
        });

  return {
    ...base,
    title: typeof patch.patch.title === 'string' ? patch.patch.title : base.title,
    source: patch.patch.source ?? base.source,
    page: typeof patch.patch.page === 'number' ? patch.patch.page : base.page,
    visible: typeof patch.patch.visible === 'boolean' ? patch.patch.visible : base.visible,
    transform: {
      x: typeof patch.patch.x === 'number' ? patch.patch.x : base.transform.x,
      y: typeof patch.patch.y === 'number' ? patch.patch.y : base.transform.y,
      scale: typeof patch.patch.scale === 'number' ? patch.patch.scale : base.transform.scale,
    },
    size: {
      width: typeof patch.patch.width === 'number' ? patch.patch.width : base.size.width,
      height: typeof patch.patch.height === 'number' ? patch.patch.height : base.size.height,
    },
  };
}

function mergeAnnotationEntity(
  current: AnnotationSceneEntity | undefined,
  patch: AnnotationScenePatch,
): AnnotationSceneEntity {
  const base =
    current ??
    createAnnotationEntity({
      id: patch.entityId,
      label: typeof patch.patch.label === 'string' ? patch.patch.label : 'Annotation marker',
      point: {
        x: typeof patch.patch.x === 'number' ? patch.patch.x : 0,
        y: typeof patch.patch.y === 'number' ? patch.patch.y : 0,
      },
    });

  return {
    ...base,
    label: typeof patch.patch.label === 'string' ? patch.patch.label : base.label,
    color: typeof patch.patch.color === 'string' ? patch.patch.color : base.color,
    visible: typeof patch.patch.visible === 'boolean' ? patch.patch.visible : base.visible,
    point: {
      x: typeof patch.patch.x === 'number' ? patch.patch.x : base.point.x,
      y: typeof patch.patch.y === 'number' ? patch.patch.y : base.point.y,
    },
    size: {
      width: typeof patch.patch.width === 'number' ? patch.patch.width : base.size.width,
      height: typeof patch.patch.height === 'number' ? patch.patch.height : base.size.height,
    },
  };
}

function bumpSceneVersion(scene: DocumentSceneState): DocumentSceneState {
  return {
    ...scene,
    sceneVersion: scene.sceneVersion + 1,
  };
}

export function applyDocumentScenePatch(
  scene: DocumentSceneState,
  patch: DocumentScenePatchEnvelope,
): DocumentSceneState {
  switch (patch.entityType) {
    case 'document': {
      if (patch.operation === 'remove') {
        return bumpSceneVersion({
          ...scene,
          document: null,
          selection:
            scene.selection.entityType === 'document' && scene.selection.entityId === patch.entityId
              ? clearSelection()
              : scene.selection,
        });
      }

      const document = mergeDocumentEntity(scene.document, patch);
      return bumpSceneVersion({
        ...scene,
        document,
        selection: {
          entityType: 'document',
          entityId: document.id,
        },
      });
    }

    case 'annotation': {
      if (patch.operation === 'remove') {
        const nextAnnotations = { ...scene.annotations };
        delete nextAnnotations[patch.entityId];

        return bumpSceneVersion({
          ...scene,
          annotations: nextAnnotations,
          selection:
            scene.selection.entityType === 'annotation' &&
            scene.selection.entityId === patch.entityId
              ? clearSelection()
              : scene.selection,
        });
      }

      const annotation = mergeAnnotationEntity(scene.annotations[patch.entityId], patch);
      return bumpSceneVersion({
        ...scene,
        annotations: {
          ...scene.annotations,
          [patch.entityId]: annotation,
        },
        selection:
          patch.operation === 'set' || patch.operation === 'replace'
            ? {
                entityType: 'annotation',
                entityId: annotation.id,
              }
            : scene.selection,
      });
    }

    case 'mode': {
      return bumpSceneVersion({
        ...scene,
        mode: {
          active: patch.operation === 'remove' ? 'IDLE' : patch.patch.active,
        },
      });
    }

    case 'selection': {
      return bumpSceneVersion({
        ...scene,
        selection: patch.operation === 'remove' ? clearSelection() : patch.patch,
      });
    }
  }
}

export function applyDocumentScenePatches(
  scene: DocumentSceneState,
  patches: DocumentScenePatchEnvelope[],
): DocumentSceneState {
  return patches.reduce(applyDocumentScenePatch, scene);
}
