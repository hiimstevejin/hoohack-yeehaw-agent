export type ScenePoint = {
  x: number;
  y: number;
};

export type SceneTransform = {
  x: number;
  y: number;
  scale: number;
};

export type SceneSize = {
  width: number;
  height: number;
};

export type DocumentSource = {
  kind: 'image';
  src: string;
  alt: string;
};

export type DocumentSceneEntity = {
  id: string;
  title: string;
  source: DocumentSource;
  page: number;
  transform: SceneTransform;
  size: SceneSize;
  visible: boolean;
};

export type AnnotationSceneEntity = {
  id: string;
  label: string;
  color: string;
  point: ScenePoint;
  size: SceneSize;
  visible: boolean;
};

export type SceneMode = 'IDLE' | 'NAVIGATION' | 'ANNOTATION_MODE';

export type ModeState = {
  active: SceneMode;
};

export type SelectionState = {
  entityType: 'document' | 'annotation' | null;
  entityId: string | null;
};

export type DocumentSceneState = {
  roomName: string;
  sceneVersion: number;
  document: DocumentSceneEntity | null;
  annotations: Record<string, AnnotationSceneEntity>;
  mode: ModeState;
  selection: SelectionState;
};

export function createDocumentEntity(
  overrides: Partial<DocumentSceneEntity> & Pick<DocumentSceneEntity, 'id' | 'title' | 'source'>,
): DocumentSceneEntity {
  return {
    id: overrides.id,
    title: overrides.title,
    source: overrides.source,
    page: overrides.page ?? 1,
    transform: overrides.transform ?? { x: 0, y: 0, scale: 1 },
    size: overrides.size ?? { width: 720, height: 480 },
    visible: overrides.visible ?? true,
  };
}

export function createAnnotationEntity(
  overrides: Partial<AnnotationSceneEntity> & Pick<AnnotationSceneEntity, 'id' | 'label' | 'point'>,
): AnnotationSceneEntity {
  return {
    id: overrides.id,
    label: overrides.label,
    color: overrides.color ?? '#7c3aed',
    point: overrides.point,
    size: overrides.size ?? { width: 160, height: 36 },
    visible: overrides.visible ?? true,
  };
}

export function createInitialDocumentSceneState(roomName: string): DocumentSceneState {
  return {
    roomName,
    sceneVersion: 0,
    document: createDocumentEntity({
      id: 'placeholder-document',
      title: 'Quarterly Review Deck',
      source: {
        kind: 'image',
        src: '/Placeholder.png',
        alt: 'Placeholder document preview',
      },
      transform: {
        x: 20,
        y: 24,
        scale: 0.56,
      },
      size: {
        width: 1280,
        height: 854,
      },
    }),
    annotations: {
      agenda: createAnnotationEntity({
        id: 'agenda',
        label: 'Agenda focus',
        point: { x: 108, y: 110 },
        color: '#d97706',
      }),
      metrics: createAnnotationEntity({
        id: 'metrics',
        label: 'Metrics callout',
        point: { x: 780, y: 332 },
        color: '#0f766e',
      }),
    },
    mode: {
      active: 'NAVIGATION',
    },
    selection: {
      entityType: 'document',
      entityId: 'placeholder-document',
    },
  };
}
