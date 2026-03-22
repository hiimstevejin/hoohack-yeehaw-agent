'use client';

import * as React from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';

import { useCollabChannel } from '@/lib/collab/useCollabChannel';
import {
  applyHighlightStroke,
  clearHighlightSurface,
  createInitialHighlightSceneState,
  getHighlightRectsForSurface,
  mergeHighlightSnapshot,
  removeHighlightStroke,
} from '@/lib/highlight/store';
import type { HighlightClearPatch, HighlightRemovePatch, HighlightStroke } from '@/lib/highlight/types';
import { isHighlightSceneSnapshot } from '@/lib/highlight/persistence';

const HIGHLIGHT_STROKE_ENTITY_TYPE = 'screen-highlight-stroke';
const HIGHLIGHT_SURFACE_ENTITY_TYPE = 'screen-highlight-surface';
const DEFAULT_HIGHLIGHT_COLOR = 'rgba(255, 225, 92, 0.28)';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHighlightRect(value: Record<string, unknown>): value is Extract<HighlightStroke, { kind: 'rect' }> {
  return (
    value.kind === 'rect' &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.width === 'number' &&
    typeof value.height === 'number'
  );
}

function isHighlightLine(value: Record<string, unknown>): value is Extract<HighlightStroke, { kind: 'line' }> {
  return (
    value.kind === 'line' &&
    typeof value.x1 === 'number' &&
    typeof value.y1 === 'number' &&
    typeof value.x2 === 'number' &&
    typeof value.y2 === 'number' &&
    typeof value.thickness === 'number'
  );
}

function isHighlightStroke(value: unknown): value is HighlightStroke {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.screenShareId === 'string' &&
    typeof value.color === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.createdBy === 'string' &&
    (isHighlightRect(value) || isHighlightLine(value))
  );
}

function isHighlightClearPatch(value: unknown): value is HighlightClearPatch {
  return (
    isRecord(value) &&
    typeof value.screenShareId === 'string' &&
    typeof value.clearedAt === 'string' &&
    typeof value.clearedBy === 'string'
  );
}

function isHighlightRemovePatch(value: unknown): value is HighlightRemovePatch {
  return (
    isRecord(value) &&
    typeof value.screenShareId === 'string' &&
    typeof value.strokeId === 'string' &&
    typeof value.removedAt === 'string' &&
    typeof value.removedBy === 'string'
  );
}

export function useSharedScreenHighlights() {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const { isReady, lastInvalidMessage, send, subscribe } = useCollabChannel();
  const [scene, setScene] = React.useState(createInitialHighlightSceneState);
  const sceneRef = React.useRef(scene);
  const pendingEventsRef = React.useRef<
    Array<
      | {
          type: 'stroke';
          stroke: HighlightStroke;
        }
      | {
          type: 'clear';
          patch: HighlightClearPatch;
        }
      | {
          type: 'remove';
          patch: HighlightRemovePatch;
        }
    >
  >([]);

  React.useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadPersistedSnapshot() {
      if (!room.name) {
        return;
      }

      try {
        const response = await fetch(`/api/rooms/${encodeURIComponent(room.name)}/scene-snapshot`);
        const payload = (await response.json()) as {
          snapshot?: unknown;
        };
        const snapshot = payload.snapshot;

        if (!response.ok || !isHighlightSceneSnapshot(snapshot)) {
          return;
        }

        if (!cancelled) {
          setScene((current) => mergeHighlightSnapshot(current, snapshot));
        }
      } catch {
        return;
      }
    }

    void loadPersistedSnapshot();

    return () => {
      cancelled = true;
    };
  }, [room.name]);

  React.useEffect(() => {
    if (!lastInvalidMessage) {
      return;
    }

    console.warn('[meet/highlight] collab invalid message', {
      error: lastInvalidMessage,
    });
  }, [lastInvalidMessage]);

  React.useEffect(() => {
    if (!isReady || pendingEventsRef.current.length === 0) {
      return;
    }

    const pendingEvents = [...pendingEventsRef.current];
    pendingEventsRef.current = [];

    void Promise.all(
      pendingEvents.map((event) => {
        if (event.type === 'stroke') {
          return send(
            {
              namespace: 'scene',
              type: 'scene.patch',
              payload: {
                entityId: event.stroke.id,
                entityType: HIGHLIGHT_STROKE_ENTITY_TYPE,
                operation: 'set',
                patch: {
                  stroke: event.stroke,
                },
              },
            },
            {
              reliability: 'reliable',
              topic: 'meet.scene.highlight',
            },
          );
        }

        if (event.type === 'clear') {
          return send(
            {
              namespace: 'scene',
              type: 'scene.patch',
              payload: {
                entityId: event.patch.screenShareId,
                entityType: HIGHLIGHT_SURFACE_ENTITY_TYPE,
                operation: 'remove',
                patch: event.patch,
              },
            },
            {
              reliability: 'reliable',
              topic: 'meet.scene.highlight',
            },
          );
        }

        return send(
          {
            namespace: 'scene',
            type: 'scene.patch',
            payload: {
              entityId: event.patch.strokeId,
              entityType: HIGHLIGHT_STROKE_ENTITY_TYPE,
              operation: 'remove',
              patch: event.patch,
            },
          },
          {
            reliability: 'reliable',
            topic: 'meet.scene.highlight',
          },
        );
      }),
    ).catch(() => {
      pendingEventsRef.current = [...pendingEvents, ...pendingEventsRef.current];
    });
  }, [isReady, send]);

  React.useEffect(() => {
    if (!localParticipant.identity || !isReady) {
      return;
    }

    return subscribe((event) => {
      if (event.namespace !== 'scene') {
        return;
      }

      if (event.type === 'scene.patch') {
        const stroke = event.payload.patch.stroke;

        if (
          event.payload.entityType === HIGHLIGHT_STROKE_ENTITY_TYPE &&
          event.payload.operation === 'set' &&
          isHighlightStroke(stroke)
        ) {
          console.debug('[meet/highlight] applying remote stroke', {
            strokeId: stroke.id,
            screenShareId: stroke.screenShareId,
            senderId: event.senderId,
          });
          setScene((current) => applyHighlightStroke(current, stroke, current.sceneVersion + 1));
        }

        if (
          event.payload.entityType === HIGHLIGHT_STROKE_ENTITY_TYPE &&
          event.payload.operation === 'remove' &&
          isHighlightRemovePatch(event.payload.patch)
        ) {
          const removePatch = event.payload.patch;
          setScene((current) =>
            removeHighlightStroke(current, removePatch, current.sceneVersion + 1),
          );
        }

        const clearPatch = event.payload.patch;

        if (
          event.payload.entityType === HIGHLIGHT_SURFACE_ENTITY_TYPE &&
          event.payload.operation === 'remove' &&
          isHighlightClearPatch(clearPatch)
        ) {
          console.debug('[meet/highlight] applying remote clear', {
            screenShareId: clearPatch.screenShareId,
            senderId: event.senderId,
          });
          setScene((current) => clearHighlightSurface(current, clearPatch, current.sceneVersion + 1));
        }
      }

      if (event.type === 'scene.sync_request') {
        if (
          event.payload.targetParticipantId &&
          event.payload.targetParticipantId !== localParticipant.identity
        ) {
          return;
        }

        void send(
          {
            namespace: 'scene',
            type: 'scene.sync_snapshot',
            payload: {
              sceneVersion: sceneRef.current.sceneVersion,
              snapshot: sceneRef.current,
            },
          },
          {
            reliability: 'reliable',
            topic: 'meet.scene.sync',
          },
        ).then(() => {
          console.debug('[meet/highlight] sent sync snapshot', {
            sceneVersion: sceneRef.current.sceneVersion,
          });
        }).catch((error) => {
          console.warn('[meet/highlight] failed to send sync snapshot', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }

      if (
        event.type === 'scene.sync_snapshot' &&
        isHighlightSceneSnapshot(event.payload.snapshot)
      ) {
        const snapshot = event.payload.snapshot;
        setScene((current) => mergeHighlightSnapshot(current, snapshot));
      }
    }, 'scene');
  }, [isReady, localParticipant.identity, send, subscribe]);

  React.useEffect(() => {
    if (!localParticipant.identity || !isReady) {
      return;
    }

    void send(
      {
        namespace: 'scene',
        type: 'scene.sync_request',
        payload: {
          targetParticipantId: undefined,
        },
      },
      {
        reliability: 'reliable',
        topic: 'meet.scene.sync',
      },
    ).catch(() => undefined);
  }, [isReady, localParticipant.identity, send]);

  React.useEffect(() => {
    if (!isReady) {
      return;
    }

    const handleParticipantConnected = () => {
      if (sceneRef.current.sceneVersion === 0) {
        return;
      }

      void send(
        {
          namespace: 'scene',
          type: 'scene.sync_snapshot',
          payload: {
            sceneVersion: sceneRef.current.sceneVersion,
            snapshot: sceneRef.current,
          },
        },
        {
          reliability: 'reliable',
          topic: 'meet.scene.sync',
        },
      ).catch(() => undefined);
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
    };
  }, [isReady, room, send]);

  React.useEffect(() => {
    if (!room.name || scene.sceneVersion === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void fetch(`/api/rooms/${encodeURIComponent(room.name)}/scene-snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sceneVersion: scene.sceneVersion,
          snapshot: scene,
        }),
      }).catch(() => undefined);
    }, 1200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [room.name, scene]);

  const addHighlight = React.useCallback(
    async (input: {
      id?: string;
      screenShareId: string;
      kind?: HighlightStroke['kind'];
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      x1?: number;
      y1?: number;
      x2?: number;
      y2?: number;
      thickness?: number;
      color?: string;
      createdAt?: string;
    }) => {
      const stroke: HighlightStroke =
        input.kind === 'line'
          ? {
              id:
                input.id ??
                (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                  ? crypto.randomUUID()
                  : `${localParticipant.identity}-${Date.now()}`),
              kind: 'line',
              screenShareId: input.screenShareId,
              x1: input.x1 ?? 0,
              y1: input.y1 ?? 0,
              x2: input.x2 ?? 0,
              y2: input.y2 ?? 0,
              thickness: input.thickness ?? 0.035,
              color: input.color ?? DEFAULT_HIGHLIGHT_COLOR,
              createdAt: input.createdAt ?? new Date().toISOString(),
              createdBy: localParticipant.identity,
            }
          : {
              id:
                input.id ??
                (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                  ? crypto.randomUUID()
                  : `${localParticipant.identity}-${Date.now()}`),
              kind: 'rect',
              screenShareId: input.screenShareId,
              x: input.x ?? 0,
              y: input.y ?? 0,
              width: input.width ?? 0.1,
              height: input.height ?? 0.08,
              color: input.color ?? DEFAULT_HIGHLIGHT_COLOR,
              createdAt: input.createdAt ?? new Date().toISOString(),
              createdBy: localParticipant.identity,
            };

      setScene((current) => applyHighlightStroke(current, stroke, current.sceneVersion + 1));

      if (!isReady) {
        pendingEventsRef.current.push({
          type: 'stroke',
          stroke,
        });
        console.debug('[meet/highlight] queued local stroke until channel ready', {
          strokeId: stroke.id,
          screenShareId: stroke.screenShareId,
        });
        return;
      }

      await send(
        {
          namespace: 'scene',
          type: 'scene.patch',
          payload: {
            entityId: stroke.id,
            entityType: HIGHLIGHT_STROKE_ENTITY_TYPE,
            operation: 'set',
            patch: {
              stroke,
            },
          },
        },
        {
          reliability: 'reliable',
          topic: 'meet.scene.highlight',
        },
      );
      console.debug('[meet/highlight] sent local stroke', {
        strokeId: stroke.id,
        screenShareId: stroke.screenShareId,
      });
    },
    [isReady, localParticipant.identity, send],
  );

  const clearHighlights = React.useCallback(
    async (screenShareId: string) => {
      const patch: HighlightClearPatch = {
        screenShareId,
        clearedAt: new Date().toISOString(),
        clearedBy: localParticipant.identity,
      };

      setScene((current) => clearHighlightSurface(current, patch, current.sceneVersion + 1));

      if (!isReady) {
        pendingEventsRef.current.push({
          type: 'clear',
          patch,
        });
        console.debug('[meet/highlight] queued local clear until channel ready', {
          screenShareId,
        });
        return;
      }

      await send(
        {
          namespace: 'scene',
          type: 'scene.patch',
          payload: {
            entityId: screenShareId,
            entityType: HIGHLIGHT_SURFACE_ENTITY_TYPE,
            operation: 'remove',
            patch,
          },
        },
        {
          reliability: 'reliable',
          topic: 'meet.scene.highlight',
        },
      );
      console.debug('[meet/highlight] sent local clear', {
        screenShareId,
      });
    },
    [isReady, localParticipant.identity, send],
  );

  const removeHighlight = React.useCallback(
    async (screenShareId: string, strokeId: string) => {
      const patch: HighlightRemovePatch = {
        screenShareId,
        strokeId,
        removedAt: new Date().toISOString(),
        removedBy: localParticipant.identity,
      };

      setScene((current) => removeHighlightStroke(current, patch, current.sceneVersion + 1));

      if (!isReady) {
        pendingEventsRef.current.push({
          type: 'remove',
          patch,
        });
        return;
      }

      await send(
        {
          namespace: 'scene',
          type: 'scene.patch',
          payload: {
            entityId: strokeId,
            entityType: HIGHLIGHT_STROKE_ENTITY_TYPE,
            operation: 'remove',
            patch,
          },
        },
        {
          reliability: 'reliable',
          topic: 'meet.scene.highlight',
        },
      );
    },
    [isReady, localParticipant.identity, send],
  );

  const getRects = React.useCallback(
    (screenShareId: string) => getHighlightRectsForSurface(scene, screenShareId),
    [scene],
  );

  return {
    sceneVersion: scene.sceneVersion,
    getRects,
    addHighlight,
    clearHighlights,
    removeHighlight,
  };
}
