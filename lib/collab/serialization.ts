import {
  ROOM_APP_EVENT_VERSION,
  type CollabMessageReceiveResult,
  type RoomAppEvent,
  type RoomAppEventNamespace,
} from '@/lib/collab/types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const ROOM_APP_NAMESPACES: RoomAppEventNamespace[] = [
  'scene',
  'annotation',
  'gesture',
  'voice',
  'document',
  'system',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNamespace(value: unknown): value is RoomAppEventNamespace {
  return typeof value === 'string' && ROOM_APP_NAMESPACES.includes(value as RoomAppEventNamespace);
}

function isOperation(value: unknown): value is 'set' | 'move' | 'resize' | 'replace' | 'remove' {
  return (
    value === 'set' ||
    value === 'move' ||
    value === 'resize' ||
    value === 'replace' ||
    value === 'remove'
  );
}

function isScenePatchPayload(payload: unknown) {
  return (
    isRecord(payload) &&
    typeof payload.entityId === 'string' &&
    typeof payload.entityType === 'string' &&
    isOperation(payload.operation) &&
    isRecord(payload.patch)
  );
}

function isSceneSyncRequestPayload(payload: unknown) {
  return (
    isRecord(payload) &&
    (payload.targetParticipantId === undefined || typeof payload.targetParticipantId === 'string')
  );
}

function isSceneSyncSnapshotPayload(payload: unknown) {
  return (
    isRecord(payload) &&
    typeof payload.sceneVersion === 'number' &&
    isRecord(payload.snapshot)
  );
}

function isVoiceStatePayload(payload: unknown) {
  return (
    isRecord(payload) &&
    (payload.state === 'idle' ||
      payload.state === 'connecting' ||
      payload.state === 'listening' ||
      payload.state === 'thinking' ||
      payload.state === 'speaking' ||
      payload.state === 'error') &&
    (payload.source === 'gesture' ||
      payload.source === 'button' ||
      payload.source === 'system') &&
    (payload.detail === undefined || typeof payload.detail === 'string')
  );
}

function isDocumentLifecyclePayload(payload: unknown) {
  return (
    isRecord(payload) &&
    typeof payload.documentId === 'string' &&
    (payload.status === 'pending' ||
      payload.status === 'processing' ||
      payload.status === 'ready' ||
      payload.status === 'failed' ||
      payload.status === 'unsupported') &&
    (payload.detail === undefined || typeof payload.detail === 'string')
  );
}

function isSystemNoticePayload(payload: unknown) {
  return (
    isRecord(payload) &&
    (payload.level === 'info' || payload.level === 'warning' || payload.level === 'error') &&
    typeof payload.message === 'string'
  );
}

export function isRoomAppEvent(value: unknown): value is RoomAppEvent {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.version !== ROOM_APP_EVENT_VERSION ||
    !isNamespace(value.namespace) ||
    typeof value.type !== 'string' ||
    typeof value.roomName !== 'string' ||
    typeof value.senderId !== 'string' ||
    typeof value.sentAt !== 'string'
  ) {
    return false;
  }

  switch (value.type) {
    case 'scene.patch':
      return isScenePatchPayload(value.payload);
    case 'scene.sync_request':
      return isSceneSyncRequestPayload(value.payload);
    case 'scene.sync_snapshot':
      return isSceneSyncSnapshotPayload(value.payload);
    case 'voice.state':
      return isVoiceStatePayload(value.payload);
    case 'document.lifecycle':
      return isDocumentLifecyclePayload(value.payload);
    case 'system.notice':
      return isSystemNoticePayload(value.payload);
    default:
      return false;
  }
}

export function encodeRoomAppEvent(event: RoomAppEvent): Uint8Array {
  return encoder.encode(JSON.stringify(event));
}

export function decodeRoomAppEvent(payload: Uint8Array): CollabMessageReceiveResult {
  try {
    const decoded = decoder.decode(payload);
    const parsed = JSON.parse(decoded) as unknown;

    if (!isRoomAppEvent(parsed)) {
      return {
        ok: false,
        error: 'Received payload is not a valid room app event.',
      };
    }

    return {
      ok: true,
      event: parsed,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to decode room app event.',
    };
  }
}
