'use client';

import * as React from 'react';

import type { SharedScreenOverlayCard } from '@/lib/overlay/types';

export function useScreenShareOverlays() {
  const [overlays, setOverlays] = React.useState<SharedScreenOverlayCard[]>([]);

  const upsertOverlay = React.useCallback((overlay: SharedScreenOverlayCard) => {
    setOverlays((current) => {
      const next = current.filter((entry) => entry.id !== overlay.id);
      return [overlay, ...next];
    });
  }, []);

  const dismissOverlay = React.useCallback((overlayId: string) => {
    setOverlays((current) => current.filter((entry) => entry.id !== overlayId));
  }, []);

  const getOverlays = React.useCallback(
    (surfaceId: string) => overlays.filter((overlay) => overlay.surfaceId === surfaceId),
    [overlays],
  );

  return {
    dismissOverlay,
    getOverlays,
    overlays,
    upsertOverlay,
  };
}
