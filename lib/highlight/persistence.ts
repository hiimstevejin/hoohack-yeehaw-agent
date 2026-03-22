import type { HighlightSceneSnapshot } from '@/lib/highlight/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isHighlightSceneSnapshot(value: unknown): value is HighlightSceneSnapshot {
  return isRecord(value) && typeof value.sceneVersion === 'number' && isRecord(value.surfaces);
}
