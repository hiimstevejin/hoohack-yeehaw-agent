'use client';

import * as React from 'react';

import { createVoiceSession } from '@/lib/ai/client/voiceSession';
import { parseVoiceOverlayRequest, summarizeDocumentToolResult, type VoiceOverlayRequest } from '@/lib/ai/toolResults';
import type {
  MeetVoiceEvent,
  VoiceInvocationSource,
  VoiceSessionState,
} from '@/lib/ai/types';
import { useCollabChannel } from '@/lib/collab/useCollabChannel';

type VoiceEventLogItem = {
  id: string;
  label: string;
  text: string;
};

export type VoiceAgentSessionController = {
  agentResponse: string;
  eventCount: number;
  events: VoiceEventLogItem[];
  finalTranscript: string;
  isSessionActive: boolean;
  lastEventType: MeetVoiceEvent['type'] | null;
  partialTranscript: string;
  remoteVoiceState: string | null;
  sessionDetail?: string;
  latestOverlayRequest: VoiceOverlayRequest | null;
  sessionSource: VoiceInvocationSource | null;
  sessionState: VoiceSessionState;
  start: (source?: VoiceInvocationSource) => Promise<boolean>;
  stop: (source?: VoiceInvocationSource) => void;
};

function buildLogItem(event: MeetVoiceEvent): VoiceEventLogItem | null {
  switch (event.type) {
    case 'stt_chunk':
      return {
        id: `${event.sessionId}:${event.ts}:partial`,
        label: 'Partial',
        text: event.transcript,
      };
    case 'stt_output':
      return {
        id: `${event.sessionId}:${event.ts}:final`,
        label: 'Final',
        text: event.transcript,
      };
    case 'agent_chunk':
      return {
        id: `${event.sessionId}:${event.ts}:chunk`,
        label: 'Agent',
        text: event.text,
      };
    case 'agent_end':
      return {
        id: `${event.sessionId}:${event.ts}:done`,
        label: 'Complete',
        text: 'Agent finished streaming.',
      };
    case 'tool_call':
      return {
        id: `${event.sessionId}:${event.ts}:tool-call`,
        label: `Tool ${event.name}`,
        text: JSON.stringify(event.args),
      };
    case 'tool_result':
      return {
        id: `${event.sessionId}:${event.ts}:tool-result`,
        label: `Tool Result ${event.name}`,
        text: event.result,
      };
    case 'tts_chunk':
      return {
        id: `${event.sessionId}:${event.ts}:tts`,
        label: 'TTS',
        text: 'Audio chunk streamed.',
      };
    case 'tts_end':
      return {
        id: `${event.sessionId}:${event.ts}:tts-end`,
        label: 'TTS',
        text: 'Audio finalized.',
      };
    case 'error':
      return {
        id: `${event.sessionId}:${event.ts}:error`,
        label: 'Error',
        text: event.message,
      };
    default:
      return null;
  }
}

function withLogOrdinal(id: string, ordinal: number) {
  return `${id}:${ordinal}`;
}

export function useVoiceAgentSession(
  roomName: string,
  localParticipantIdentity: string,
): VoiceAgentSessionController {
  const collab = useCollabChannel(roomName);
  const [events, setEvents] = React.useState<VoiceEventLogItem[]>([]);
  const [partialTranscript, setPartialTranscript] = React.useState('');
  const [finalTranscript, setFinalTranscript] = React.useState('');
  const [agentResponse, setAgentResponse] = React.useState('');
  const [sessionState, setSessionState] = React.useState<VoiceSessionState>('idle');
  const [sessionDetail, setSessionDetail] = React.useState<string | undefined>(undefined);
  const [sessionSource, setSessionSource] = React.useState<VoiceInvocationSource | null>(null);
  const [remoteVoiceState, setRemoteVoiceState] = React.useState<string | null>(null);
  const [latestOverlayRequest, setLatestOverlayRequest] = React.useState<VoiceOverlayRequest | null>(null);
  const [lastEventType, setLastEventType] = React.useState<MeetVoiceEvent['type'] | null>(null);
  const [eventCount, setEventCount] = React.useState(0);
  const logOrdinalRef = React.useRef(0);
  const collabReadyRef = React.useRef(collab.isReady);
  const collabSendRef = React.useRef(collab.send);
  const sessionSourceRef = React.useRef<VoiceInvocationSource | null>(null);
  const persistedTurnIdsRef = React.useRef(new Set<string>());
  const turnDraftRef = React.useRef<{
    agentResponse: string;
    errorMessage: string | null;
    finalTranscript: string;
    sessionId: string | null;
    toolNames: Set<string>;
  }>({
    agentResponse: '',
    errorMessage: null,
    finalTranscript: '',
    sessionId: null,
    toolNames: new Set<string>(),
  });

  React.useEffect(() => {
    collabReadyRef.current = collab.isReady;
    collabSendRef.current = collab.send;
  }, [collab.isReady, collab.send]);

  const session = React.useMemo(() => {
    return createVoiceSession({
      roomName,
      onEvent(event) {
        const ordinal = logOrdinalRef.current++;
        const logItem = buildLogItem(event);
        setLastEventType(event.type);
        setEventCount((current) => current + 1);
        turnDraftRef.current.sessionId = event.sessionId;

        if (event.type === 'stt_chunk') {
          setPartialTranscript(event.transcript);
        }

        if (event.type === 'stt_output') {
          setPartialTranscript('');
          setFinalTranscript(event.transcript);
          setAgentResponse('');
          turnDraftRef.current.finalTranscript = event.transcript;
          turnDraftRef.current.agentResponse = '';
          turnDraftRef.current.errorMessage = null;
          turnDraftRef.current.toolNames = new Set<string>();
        }

        if (event.type === 'agent_chunk') {
          setAgentResponse((current) => `${current}${event.text}`);
          turnDraftRef.current.agentResponse = `${turnDraftRef.current.agentResponse}${event.text}`;
        }

        if (event.type === 'tool_result') {
          turnDraftRef.current.toolNames.add(event.name);
          const overlayRequest = parseVoiceOverlayRequest(event);

          if (overlayRequest) {
            setLatestOverlayRequest(overlayRequest);
          }

          const documentSummary = event.name === 'search_uploaded_document'
            ? summarizeDocumentToolResult(event.result)
            : null;

          if (documentSummary && documentSummary.matchCount > 0) {
            setSessionDetail(
              `Grounded document matches found in ${documentSummary.fileName || 'the latest upload'} on pages ${documentSummary.pageNumbers.join(', ') || 'n/a'}.`,
            );
          }
        }

        if (event.type === 'error') {
          turnDraftRef.current.errorMessage = event.message;
        }

        if (logItem) {
          setEvents((current) => [
            {
              ...logItem,
              id: withLogOrdinal(logItem.id, ordinal),
            },
            ...current,
          ].slice(0, 18));
        }
      },
      onStateChange(state, detail) {
        setSessionState(state);
        setSessionDetail(detail);

        if (state === 'idle' || state === 'error') {
          sessionSourceRef.current = null;
          setSessionSource(null);
        }

        if (!collabReadyRef.current) {
          return;
        }

        void collabSendRef.current({
          namespace: 'voice',
          type: 'voice.state',
          payload: {
            state,
            source: sessionSourceRef.current ?? 'system',
            detail,
          },
        }).catch(() => undefined);
      },
    });
  }, [roomName]);

  const persistTurn = React.useCallback(() => {
    const draft = turnDraftRef.current;

    if (!draft.sessionId || (!draft.finalTranscript && !draft.agentResponse && !draft.errorMessage)) {
      return;
    }

    const turnId = `${draft.sessionId}:${draft.finalTranscript}:${draft.agentResponse}`.slice(0, 500);

    if (persistedTurnIdsRef.current.has(turnId)) {
      return;
    }

    persistedTurnIdsRef.current.add(turnId);

    void fetch(`/api/rooms/${encodeURIComponent(roomName)}/voice-turns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        turnId,
        sessionId: draft.sessionId,
        participantIdentity: localParticipantIdentity,
        source: sessionSourceRef.current,
        finalTranscript: draft.finalTranscript,
        agentResponse: draft.agentResponse,
        eventCount,
        toolNames: Array.from(draft.toolNames),
        errorMessage: draft.errorMessage,
      }),
    }).catch(() => {
      persistedTurnIdsRef.current.delete(turnId);
    });
  }, [eventCount, localParticipantIdentity, roomName]);

  React.useEffect(() => {
    return () => {
      session.stop();
    };
  }, [session]);

  React.useEffect(() => {
    return collab.subscribe((event) => {
      if (event.type !== 'voice.state') {
        return;
      }

      if (event.senderId === localParticipantIdentity) {
        return;
      }

      setRemoteVoiceState(`${event.senderId}: ${event.payload.state}`);
    }, 'voice');
  }, [collab, localParticipantIdentity]);

  React.useEffect(() => {
    if (lastEventType === 'agent_end' || sessionState === 'error') {
      persistTurn();
    }
  }, [lastEventType, persistTurn, sessionState]);

  const start = React.useCallback(
    async (source: VoiceInvocationSource = 'button') => {
      turnDraftRef.current = {
        agentResponse: '',
        errorMessage: null,
        finalTranscript: '',
        sessionId: null,
        toolNames: new Set<string>(),
      };
      sessionSourceRef.current = source;
      setSessionSource(source);
      const started = await session.start();

      if (!started) {
        sessionSourceRef.current = null;
        setSessionSource(null);
      }

      return started;
    },
    [session],
  );

  const stop = React.useCallback(
    (source: VoiceInvocationSource = 'button') => {
      sessionSourceRef.current = source;
      setSessionSource(source);
      session.stop();
      sessionSourceRef.current = null;
      setSessionSource(null);
    },
    [session],
  );

  const isSessionActive =
    sessionState === 'connecting' ||
    sessionState === 'listening' ||
    sessionState === 'thinking' ||
    sessionState === 'speaking';

  return {
    agentResponse,
    eventCount,
    events,
    finalTranscript,
    isSessionActive,
    lastEventType,
    partialTranscript,
    remoteVoiceState,
    sessionDetail,
    latestOverlayRequest,
    sessionSource,
    sessionState,
    start,
    stop,
  };
}
