'use client';

import * as React from 'react';
import { useRoomContext } from '@livekit/components-react';

import { createCollabChannel } from '@/lib/collab/channel';
import type { RoomAppEvent, RoomAppEventSubscriber, SendRoomAppEventOptions } from '@/lib/collab/types';

export function useCollabChannel(roomName?: string) {
  const room = useRoomContext();
  const [channel, setChannel] = React.useState<ReturnType<typeof createCollabChannel> | null>(null);
  const [lastInvalidMessage, setLastInvalidMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const effectiveRoomName = roomName ?? room.name ?? 'meet-room';
    const nextChannel = createCollabChannel({
      room,
      roomName: effectiveRoomName,
      onInvalidMessage: setLastInvalidMessage,
    });

    setChannel(nextChannel);

    return () => {
      nextChannel.dispose();
      setChannel(null);
    };
  }, [room, roomName]);

  const send = React.useCallback(
    async (
      event: Omit<RoomAppEvent, 'roomName' | 'senderId' | 'sentAt' | 'version'>,
      options?: SendRoomAppEventOptions,
    ) => {
      if (!channel) {
        throw new Error('Collaboration channel is not ready.');
      }

      return channel.send(event, options);
    },
    [channel],
  );

  const subscribe = React.useCallback(
    (subscriber: RoomAppEventSubscriber, namespace?: RoomAppEvent['namespace']) => {
      if (!channel) {
        return () => undefined;
      }

      return channel.subscribe(subscriber, namespace);
    },
    [channel],
  );

  return {
    isReady: channel !== null,
    lastInvalidMessage,
    send,
    subscribe,
  };
}
