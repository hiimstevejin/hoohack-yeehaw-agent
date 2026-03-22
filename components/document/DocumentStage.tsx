'use client';

import * as React from 'react';

import { useDocumentScene } from '@/lib/document/useDocumentScene';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function StageButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { children, style, ...rest } = props;

  return (
    <button
      {...rest}
      style={{
        borderRadius: '999px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        background: 'rgba(255, 255, 255, 0.05)',
        color: 'white',
        padding: '0.45rem 0.8rem',
        fontSize: '0.85rem',
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function DocumentStage() {
  const {
    scene,
    clearSelection,
    moveDocumentTo,
    resetDocument,
    selectAnnotation,
    selectDocument,
    setMode,
    zoomDocumentTo,
  } = useDocumentScene('meet-phase-4');
  const dragStateRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const document = scene.document;
  const annotations = React.useMemo(() => {
    return Object.values(scene.annotations).filter((annotation) => annotation.visible);
  }, [scene.annotations]);

  const handleDocumentPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!document) {
        return;
      }

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: document.transform.x,
        originY: document.transform.y,
      };
      selectDocument();
      setMode('NAVIGATION');
    },
    [document, selectDocument, setMode],
  );

  const handleDocumentPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!document || !dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - dragStateRef.current.startX;
      const deltaY = event.clientY - dragStateRef.current.startY;

      moveDocumentTo({
        x: Number((dragStateRef.current.originX + deltaX).toFixed(2)),
        y: Number((dragStateRef.current.originY + deltaY).toFixed(2)),
      });
    },
    [document, moveDocumentTo],
  );

  const endDrag = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const handleWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!document) {
        return;
      }

      event.preventDefault();
      const scaleDelta = event.deltaY > 0 ? -0.08 : 0.08;
      zoomDocumentTo(clamp(document.transform.scale + scaleDelta, 0.3, 2.4));
      selectDocument();
    },
    [document, selectDocument, zoomDocumentTo],
  );

  return (
    <section
      style={{
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '20px',
        background:
          'linear-gradient(180deg, rgba(18, 24, 33, 0.88) 0%, rgba(11, 15, 22, 0.92) 100%)',
        padding: '1rem',
        boxShadow: '0 18px 44px rgba(0, 0, 0, 0.22)',
        overflow: 'hidden',
        display: 'grid',
        gap: '0.9rem',
      }}
    >
      <div style={{ display: 'grid', gap: '0.35rem' }}>
        <h2
          style={{
            margin: 0,
            fontSize: '0.95rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            opacity: 0.78,
          }}
        >
          Document Stage
        </h2>
        <p
          style={{
            margin: 0,
            color: 'rgba(255, 255, 255, 0.72)',
            lineHeight: 1.45,
            fontSize: '0.95rem',
          }}
        >
          Local Phase 4 stage backed by deterministic scene patches. Drag to move,
          use the wheel to zoom, and select annotations independently from the document.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <StageButton onClick={() => setMode('NAVIGATION')}>Navigation</StageButton>
        <StageButton onClick={() => setMode('ANNOTATION_MODE')}>Annotation Mode</StageButton>
        <StageButton onClick={resetDocument}>Reset</StageButton>
        <StageButton onClick={clearSelection}>Clear Selection</StageButton>
      </div>

      <div
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            clearSelection();
          }
        }}
        onWheel={handleWheel}
        style={{
          position: 'relative',
          height: '420px',
          overflow: 'hidden',
          borderRadius: '18px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background:
            'radial-gradient(circle at top left, rgba(67, 125, 208, 0.15), transparent 34%), rgba(3, 5, 9, 0.96)',
        }}
      >
        {document ? (
          <div
            role="presentation"
            onPointerDown={handleDocumentPointerDown}
            onPointerMove={handleDocumentPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: `${document.size.width}px`,
              height: `${document.size.height}px`,
              transform: `translate(${document.transform.x}px, ${document.transform.y}px) scale(${document.transform.scale})`,
              transformOrigin: 'top left',
              borderRadius: '20px',
              overflow: 'hidden',
              cursor: dragStateRef.current ? 'grabbing' : 'grab',
              boxShadow:
                scene.selection.entityType === 'document'
                  ? '0 0 0 2px rgba(86, 165, 255, 0.9), 0 30px 80px rgba(0, 0, 0, 0.3)'
                  : '0 30px 80px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={document.source.src}
              alt={document.source.alt}
              draggable={false}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />

            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {annotations.map((annotation) => (
                <button
                  key={annotation.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    selectAnnotation(annotation.id);
                    setMode('ANNOTATION_MODE');
                  }}
                  style={{
                    position: 'absolute',
                    left: `${annotation.point.x}px`,
                    top: `${annotation.point.y}px`,
                    width: `${annotation.size.width}px`,
                    minHeight: `${annotation.size.height}px`,
                    padding: '0.35rem 0.55rem',
                    borderRadius: '999px',
                    border:
                      scene.selection.entityType === 'annotation' &&
                      scene.selection.entityId === annotation.id
                        ? '2px solid rgba(255, 255, 255, 0.95)'
                        : '1px solid rgba(255, 255, 255, 0.2)',
                    background: annotation.color,
                    color: '#fff',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.2)',
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                  }}
                >
                  {annotation.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div
            style={{
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              color: 'rgba(255, 255, 255, 0.66)',
              textAlign: 'center',
              padding: '1rem',
            }}
          >
            No document loaded into the local scene.
          </div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gap: '0.4rem',
          borderRadius: '16px',
          padding: '0.85rem',
          background: 'rgba(255, 255, 255, 0.04)',
          color: 'rgba(255, 255, 255, 0.78)',
          fontSize: '0.88rem',
        }}
      >
        <div>Scene version: {scene.sceneVersion}</div>
        <div>Mode: {scene.mode.active}</div>
        <div>
          Selection: {scene.selection.entityType ?? 'none'}
          {scene.selection.entityId ? ` (${scene.selection.entityId})` : ''}
        </div>
        <div>
          Transform:{' '}
          {document
            ? `${document.transform.x.toFixed(0)}, ${document.transform.y.toFixed(0)} @ ${document.transform.scale.toFixed(2)}x`
            : 'none'}
        </div>
      </div>
    </section>
  );
}
