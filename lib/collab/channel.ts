import { Room, RoomEvent } from 'livekit-client';

import {
  ROOM_APP_EVENT_VERSION,
  type RoomAppEvent,
  type RoomAppEventSubscriber,
  type SendRoomAppEventOptions,
} from '@/lib/collab/types';
import { decodeRoomAppEvent, encodeRoomAppEvent } from '@/lib/collab/serialization';

type CreateCollabChannelOptions = {
  room: Room;
  roomName: string;
  onInvalidMessage?: (reason: string) => void;
};

type ChannelListener = {
  subscriber: RoomAppEventSubscriber;
  namespace?: RoomAppEvent['namespace'];
};

export function createCollabChannel({
  room,
  roomName,
  onInvalidMessage,
}: CreateCollabChannelOptions) {
  const listeners = new Set<ChannelListener>();

  const handleDataReceived = (payload: Uint8Array) => {
    const result = decodeRoomAppEvent(payload);

    if (!result.ok) {
      console.warn('[meet/collab] invalid message received', {
        roomName,
        error: result.error,
      });
      onInvalidMessage?.(result.error);
      return;
    }

    if (result.event.version !== ROOM_APP_EVENT_VERSION) {
      console.warn('[meet/collab] unsupported event version', {
        roomName,
        version: result.event.version,
        type: result.event.type,
      });
      onInvalidMessage?.(`Unsupported room app event version: ${result.event.version}`);
      return;
    }

    console.debug('[meet/collab] data received', {
      roomName,
      namespace: result.event.namespace,
      type: result.event.type,
      senderId: result.event.senderId,
    });

    listeners.forEach((listener) => {
      if (listener.namespace && listener.namespace !== result.event.namespace) {
        return;
      }

      listener.subscriber(result.event);
    });
  };

  room.on(RoomEvent.DataReceived, handleDataReceived);

  function buildEvent(event: Omit<RoomAppEvent, 'roomName' | 'senderId' | 'sentAt' | 'version'>) {
    return {
      ...event,
      version: ROOM_APP_EVENT_VERSION,
      roomName,
      senderId: room.localParticipant.identity,
      sentAt: new Date().toISOString(),
    } as RoomAppEvent;
  }

  return {
    async send(
      event: Omit<RoomAppEvent, 'roomName' | 'senderId' | 'sentAt' | 'version'>,
      options?: SendRoomAppEventOptions,
    ) {
      const envelope = buildEvent(event);
      const payload = encodeRoomAppEvent(envelope);

      console.debug('[meet/collab] publishing data', {
        roomName,
        namespace: envelope.namespace,
        type: envelope.type,
        senderId: envelope.senderId,
        reliable: (options?.reliability ?? 'reliable') === 'reliable',
        topic: options?.topic,
      });

      await room.localParticipant.publishData(payload, {
        reliable: (options?.reliability ?? 'reliable') === 'reliable',
        topic: options?.topic,
      } as any);

      return envelope;
    },

    subscribe(subscriber: RoomAppEventSubscriber, namespace?: RoomAppEvent['namespace']) {
      const listener: ChannelListener = {
        subscriber,
        namespace,
      };
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    dispose() {
      listeners.clear();
      room.off(RoomEvent.DataReceived, handleDataReceived);
    },
  };
}
