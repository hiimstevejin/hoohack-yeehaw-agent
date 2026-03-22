type HighlightStrokeBase = {
  id: string;
  screenShareId: string;
  color: string;
  createdAt: string;
  createdBy: string;
};

export type HighlightRect = HighlightStrokeBase & {
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HighlightLine = HighlightStrokeBase & {
  kind: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
};

export type HighlightStroke = HighlightRect | HighlightLine;

export type HighlightSurfaceState = {
  rects: Record<string, HighlightStroke>;
  order: string[];
  lastClearedAt: string | null;
  lastClearedBy: string | null;
};

export type HighlightSceneState = {
  sceneVersion: number;
  surfaces: Record<string, HighlightSurfaceState>;
};

export type HighlightSceneSnapshot = {
  sceneVersion: number;
  surfaces: Record<string, HighlightSurfaceState>;
};

export type HighlightStrokePatch = {
  stroke: HighlightStroke;
};

export type HighlightClearPatch = {
  screenShareId: string;
  clearedAt: string;
  clearedBy: string;
};

export type HighlightRemovePatch = {
  screenShareId: string;
  strokeId: string;
  removedAt: string;
  removedBy: string;
};
