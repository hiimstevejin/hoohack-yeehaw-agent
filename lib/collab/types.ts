export const ROOM_APP_EVENT_VERSION = 1 as const;

export type RoomAppEventVersion = typeof ROOM_APP_EVENT_VERSION;

export type RoomAppEventNamespace =
  | "scene"
  | "annotation"
  | "gesture"
  | "voice"
  | "document"
  | "system";

export type CollabMessageReliability = "reliable" | "lossy";

export type RoomAppEventEnvelope<
  TType extends string = string,
  TPayload = Record<string, unknown>,
> = {
  version: RoomAppEventVersion;
  namespace: RoomAppEventNamespace;
  type: TType;
  roomName: string;
  senderId: string;
  sentAt: string;
  payload: TPayload;
};

export type ScenePatchPayload = {
  entityId: string;
  entityType: string;
  operation: "set" | "move" | "resize" | "replace" | "remove";
  patch: Record<string, unknown>;
};

export type ScenePatchEvent = RoomAppEventEnvelope<
  "scene.patch",
  ScenePatchPayload
>;

export type SceneSyncRequestEvent = RoomAppEventEnvelope<
  "scene.sync_request",
  {
    targetParticipantId?: string;
  }
>;

export type SceneSyncSnapshotEvent = RoomAppEventEnvelope<
  "scene.sync_snapshot",
  {
    sceneVersion: number;
    snapshot: Record<string, unknown>;
  }
>;

export type VoiceStatePayload = {
  state: "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";
  source: "gesture" | "button" | "system";
  detail?: string;
};

export type VoiceStateEvent = RoomAppEventEnvelope<
  "voice.state",
  VoiceStatePayload
>;

export type DocumentLifecyclePayload = {
  documentId: string;
  status: "pending" | "processing" | "ready" | "failed" | "unsupported";
  detail?: string;
};

export type DocumentLifecycleEvent = RoomAppEventEnvelope<
  "document.lifecycle",
  DocumentLifecyclePayload
>;

export type SystemNoticeEvent = RoomAppEventEnvelope<
  "system.notice",
  {
    level: "info" | "warning" | "error";
    message: string;
  }
>;

export type RoomAppEvent =
  | ScenePatchEvent
  | SceneSyncRequestEvent
  | SceneSyncSnapshotEvent
  | VoiceStateEvent
  | DocumentLifecycleEvent
  | SystemNoticeEvent;

export type RoomAppEventSubscriber = (event: RoomAppEvent) => void;

export type SendRoomAppEventOptions = {
  reliability?: CollabMessageReliability;
  topic?: string;
};

export type CollabMessageReceiveResult =
  | {
      ok: true;
      event: RoomAppEvent;
    }
  | {
      ok: false;
      error: string;
    };
