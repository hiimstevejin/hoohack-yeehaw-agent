'use client';

import * as React from 'react';
import { ParticipantTile, type TrackReference } from '@livekit/components-react';

import { FinancialOverlayCard } from '@/components/overlay/FinancialOverlayCard';
import type { HighlightRect, HighlightStroke } from '@/lib/highlight/types';
import type { SharedScreenOverlayCard } from '@/lib/overlay/types';

type DragState = {
  originX: number;
  originY: number;
  pointerId: number;
};

type ScreenShareHighlightTileProps = {
  trackRef: TrackReference;
  surfaceId: string;
  rects: HighlightStroke[];
  pointer?: { x: number; y: number } | null;
  pointerMode?: 'idle' | 'annotation_ready' | 'drawing' | 'erasing' | 'ai_listening';
  overlays?: SharedScreenOverlayCard[];
  onAddHighlight: (input: {
    screenShareId: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }) => Promise<void>;
  onClearHighlights: (screenShareId: string) => Promise<void>;
  onDismissOverlay?: (overlayId: string) => void;
};

function toRelativePoint(event: React.PointerEvent<HTMLDivElement>, element: HTMLDivElement) {
  const bounds = element.getBoundingClientRect();

  if (bounds.width === 0 || bounds.height === 0) {
    return null;
  }

  return {
    x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
    y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
  };
}

export function ScreenShareHighlightTile({
  trackRef,
  surfaceId,
  rects,
  pointer,
  pointerMode = 'idle',
  overlays = [],
  onAddHighlight,
  onClearHighlights,
  onDismissOverlay,
}: ScreenShareHighlightTileProps) {
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = React.useState<DragState | null>(null);
  const [draftRect, setDraftRect] = React.useState<HighlightRect | null>(null);
  const strokeCount = rects.length;

  const finishHighlight = React.useCallback(
    async (nextRect: HighlightRect | null) => {
      setDraftRect(null);
      setDragState(null);

      if (!nextRect) {
        return;
      }

      await onAddHighlight({
        screenShareId: nextRect.screenShareId,
        x: nextRect.x,
        y: nextRect.y,
        width: nextRect.width,
        height: nextRect.height,
      });
    },
    [onAddHighlight],
  );

  return (
    <div
      style={{
        position: 'relative',
        minHeight: 0,
        borderRadius: '22px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(5, 7, 11, 0.9)',
      }}
    >
      <ParticipantTile
        trackRef={trackRef}
        style={{
          height: '100%',
          position: 'relative',
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '0.9rem',
          right: '0.9rem',
          zIndex: 6,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.45rem 0.6rem',
          borderRadius: '999px',
          background: 'rgba(5, 7, 11, 0.78)',
          backdropFilter: 'blur(10px)',
          fontSize: '0.78rem',
        }}
      >
        <span>
          {strokeCount} highlight{strokeCount === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={() => void onClearHighlights(surfaceId)}
          style={{
            border: 'none',
            borderRadius: '999px',
            padding: '0.3rem 0.55rem',
            background: 'rgba(255, 255, 255, 0.12)',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
      </div>
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          zIndex: 7,
          display: 'grid',
          gap: '0.75rem',
          width: 'min(360px, calc(100% - 2rem))',
          pointerEvents: 'none',
        }}
      >
        {overlays.map((overlay) => (
          <div key={overlay.id} style={{ pointerEvents: 'auto' }}>
            <FinancialOverlayCard overlay={overlay} onDismiss={onDismissOverlay} />
          </div>
        ))}
      </div>
      <div
        ref={overlayRef}
        onPointerDown={(event) => {
          const overlay = overlayRef.current;
          const point = overlay ? toRelativePoint(event, overlay) : null;

          if (!overlay || !point) {
            return;
          }

          overlay.setPointerCapture(event.pointerId);
          setDragState({
            originX: point.x,
            originY: point.y,
            pointerId: event.pointerId,
          });
          setDraftRect({
            id: 'draft',
            kind: 'rect',
            screenShareId: surfaceId,
            x: point.x,
            y: point.y,
            width: 0.02,
            height: 0.02,
            color: 'rgba(255, 225, 92, 0.28)',
            createdAt: '',
            createdBy: '',
          });
        }}
        onPointerMove={(event) => {
          const overlay = overlayRef.current;

          if (!overlay || !dragState || dragState.pointerId !== event.pointerId) {
            return;
          }

          const point = toRelativePoint(event, overlay);

          if (!point) {
            return;
          }

          const x = Math.min(dragState.originX, point.x);
          const y = Math.min(dragState.originY, point.y);
          const width = Math.max(0.02, Math.abs(point.x - dragState.originX));
          const height = Math.max(0.02, Math.abs(point.y - dragState.originY));

          setDraftRect((current) =>
            current
              ? {
                  ...current,
                  x,
                  y,
                  width,
                  height,
                }
              : current,
          );
        }}
        onPointerUp={(event) => {
          const overlay = overlayRef.current;

          if (overlay && dragState && dragState.pointerId === event.pointerId) {
            overlay.releasePointerCapture(event.pointerId);
          }

          void finishHighlight(draftRect);
        }}
        onPointerCancel={() => {
          setDraftRect(null);
          setDragState(null);
        }}
        style={{
          position: 'absolute',
          inset: 0,
          cursor: 'crosshair',
          zIndex: 5,
          pointerEvents: 'auto',
        }}
      >
        {rects.map((rect) =>
          rect.kind === 'rect' ? (
            <div
              key={rect.id}
              style={{
                position: 'absolute',
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.width * 100}%`,
                height: `${rect.height * 100}%`,
                borderRadius: '10px',
                background: 'rgba(255, 232, 120, 0.24)',
              }}
            />
          ) : (
            <svg
              key={rect.id}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                overflow: 'visible',
                pointerEvents: 'none',
                zIndex: 5,
              }}
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
            >
              <line
                x1={rect.x1}
                y1={rect.y1}
                x2={rect.x2}
                y2={rect.y2}
                stroke="rgba(255, 232, 120, 0.34)"
                strokeWidth={rect.thickness}
                strokeLinecap="round"
              />
            </svg>
          ),
        )}
        {pointer ? (
          <div
            style={{
              position: 'absolute',
              left: `${pointer.x * 100}%`,
              top: `${pointer.y * 100}%`,
              width: '24px',
              height: '24px',
              marginLeft: '-12px',
              marginTop: '-12px',
              borderRadius: '999px',
              background:
                pointerMode === 'erasing'
                  ? 'rgba(255, 120, 120, 0.18)'
                  : 'rgba(255, 240, 170, 0.18)',
              border:
                pointerMode === 'erasing'
                  ? '2px solid rgba(255, 145, 145, 0.95)'
                  : '2px solid rgba(255, 240, 170, 0.95)',
              boxShadow:
                pointerMode === 'erasing'
                  ? '0 0 0 6px rgba(255, 96, 96, 0.12), 0 0 18px rgba(255, 120, 120, 0.75)'
                  : '0 0 0 6px rgba(255, 208, 64, 0.12), 0 0 18px rgba(255, 216, 102, 0.75)',
              pointerEvents: 'none',
            }}
          >
            {pointerMode === 'erasing' ? (
              <>
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: '12px',
                    height: '2px',
                    marginLeft: '-6px',
                    marginTop: '-1px',
                    borderRadius: '999px',
                    background: 'rgba(255, 255, 255, 0.95)',
                    transform: 'rotate(45deg)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: '12px',
                    height: '2px',
                    marginLeft: '-6px',
                    marginTop: '-1px',
                    borderRadius: '999px',
                    background: 'rgba(255, 255, 255, 0.95)',
                    transform: 'rotate(-45deg)',
                  }}
                />
              </>
            ) : (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: '6px',
                  height: '6px',
                  marginLeft: '-3px',
                  marginTop: '-3px',
                  borderRadius: '999px',
                  background: 'rgba(255, 255, 255, 0.95)',
                }}
              />
            )}
          </div>
        ) : null}
        {draftRect ? (
          <div
            style={{
              position: 'absolute',
              left: `${draftRect.x * 100}%`,
              top: `${draftRect.y * 100}%`,
              width: `${draftRect.width * 100}%`,
              height: `${draftRect.height * 100}%`,
              borderRadius: '10px',
              background: draftRect.color,
              outline: '2px dashed rgba(255, 245, 179, 0.95)',
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
