'use client';

import { useLocalParticipant } from '@livekit/components-react';

import type { GestureVoiceInvocationState } from '@/lib/ai/useGestureVoiceInvocation';
import type { VoiceAgentSessionController } from '@/lib/ai/useVoiceAgentSession';
import type { VoiceSessionState } from '@/lib/ai/types';

function stateDescription(state: VoiceSessionState, detail?: string) {
  switch (state) {
    case 'connecting':
      return 'Preparing microphone capture and opening the voice stream.';
    case 'listening':
      return 'Listening for live speech and partial transcript updates.';
    case 'thinking':
      return 'Transcript finalized. Waiting for streamed agent output.';
    case 'speaking':
      return 'Agent response is streaming back live.';
    case 'error':
      return detail ?? 'Voice session failed.';
    default:
      return 'Idle until you start a voice turn.';
  }
}

export function VoiceAgentPanel(props: {
  session: VoiceAgentSessionController;
  gestureInvocation: GestureVoiceInvocationState;
}) {
  const { localParticipant } = useLocalParticipant();
  const isMeetingMicLive = localParticipant.isMicrophoneEnabled;

  return (
    <section
      style={{
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '20px',
        background:
          'linear-gradient(180deg, rgba(18, 24, 33, 0.88) 0%, rgba(11, 15, 22, 0.92) 100%)',
        padding: '1rem',
        boxShadow: '0 18px 44px rgba(0, 0, 0, 0.22)',
        overflow: 'visible',
        display: 'grid',
        gap: '0.9rem',
        minHeight: '520px',
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
          Voice Agent
        </h2>
        <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.72)', lineHeight: 1.45 }}>
          Phase 8 uses the `voice-sandwich-demo` process inside `/meet`: PCM microphone capture,
          WebSocket transport, streaming STT, streaming OpenAI agent output, and streaming TTS.
        </p>
        <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.58)', lineHeight: 1.45, fontSize: '0.85rem' }}>
          Meeting microphone stays {isMeetingMicLive ? 'live' : 'muted'} while AI listening runs on
          its own local capture path.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '0.5rem',
          borderRadius: '16px',
          padding: '0.85rem',
          background: 'rgba(255, 255, 255, 0.04)',
        }}
      >
        <div>
          <strong>Status:</strong> {props.session.sessionState}
        </div>
        <div style={{ color: 'rgba(255, 255, 255, 0.72)' }}>
          {stateDescription(props.session.sessionState, props.session.sessionDetail)}
        </div>
        <div style={{ color: 'rgba(255, 255, 255, 0.62)', fontSize: '0.84rem' }}>
          <strong>Debug:</strong> {props.session.eventCount} events received
          {props.session.lastEventType ? `, last=${props.session.lastEventType}` : ''}.
        </div>
        <div style={{ color: 'rgba(255, 255, 255, 0.62)' }}>
          <strong>Invocation:</strong>{' '}
          {props.session.sessionSource
            ? `${props.session.sessionSource} triggered`
            : 'waiting for button or gesture'}
          {props.gestureInvocation.isCoolingDown
            ? `, gesture cooldown ${Math.ceil(props.gestureInvocation.cooldownRemainingMs / 1000)}s`
            : ''}
          .
        </div>
        {props.session.remoteVoiceState ? (
          <div style={{ color: 'rgba(255, 255, 255, 0.62)' }}>
            <strong>Room activity:</strong> {props.session.remoteVoiceState}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => void props.session.start('button')}
          disabled={props.session.isSessionActive}
          style={{
            borderRadius: '999px',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            background: props.session.isSessionActive ? 'rgba(255, 255, 255, 0.12)' : '#8fe3c0',
            color: '#08120d',
            padding: '0.6rem 0.95rem',
            fontWeight: 600,
            cursor: props.session.isSessionActive ? 'not-allowed' : 'pointer',
          }}
        >
          Start Listening
        </button>
        <button
          type="button"
          onClick={() => props.session.stop('button')}
          disabled={!props.session.isSessionActive}
          style={{
            borderRadius: '999px',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            background: !props.session.isSessionActive ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 180, 160, 0.9)',
            color: '#24110b',
            padding: '0.6rem 0.95rem',
            fontWeight: 600,
            cursor: !props.session.isSessionActive ? 'not-allowed' : 'pointer',
          }}
        >
          Stop
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '0.7rem',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        }}
      >
        <div
          style={{
            minWidth: 0,
            borderRadius: '16px',
            padding: '0.85rem',
            background: 'rgba(255, 255, 255, 0.04)',
          }}
        >
          <strong>Partial Transcript</strong>
          <div
            style={{
              marginTop: '0.45rem',
              color: 'rgba(255, 255, 255, 0.78)',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              maxHeight: '140px',
              overflow: 'auto',
            }}
          >
            {props.session.partialTranscript || 'Waiting for speech...'}
          </div>
        </div>
        <div
          style={{
            minWidth: 0,
            borderRadius: '16px',
            padding: '0.85rem',
            background: 'rgba(255, 255, 255, 0.04)',
          }}
        >
          <strong>Final Transcript</strong>
          <div
            style={{
              marginTop: '0.45rem',
              color: 'rgba(255, 255, 255, 0.78)',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              maxHeight: '140px',
              overflow: 'auto',
            }}
          >
            {props.session.finalTranscript || 'No final transcript yet.'}
          </div>
        </div>
      </div>

      <div
        style={{
          minWidth: 0,
          borderRadius: '16px',
          padding: '0.85rem',
          background: 'rgba(255, 255, 255, 0.04)',
        }}
      >
        <strong>Agent Response</strong>
        <div
          style={{
            marginTop: '0.45rem',
            color: 'rgba(255, 255, 255, 0.78)',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            maxHeight: '180px',
            overflow: 'auto',
          }}
        >
          {props.session.agentResponse || 'No agent response yet.'}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '0.35rem',
          maxHeight: '220px',
          overflow: 'auto',
          borderRadius: '16px',
          padding: '0.85rem',
          background: 'rgba(5, 7, 11, 0.22)',
        }}
      >
        <strong>Voice Event Feed</strong>
        {props.session.events.length > 0 ? (
          props.session.events.map((event) => (
            <div key={event.id} style={{ color: 'rgba(255, 255, 255, 0.76)', overflowWrap: 'anywhere' }}>
              <strong>{event.label}:</strong> {event.text}
            </div>
          ))
        ) : (
          <div style={{ color: 'rgba(255, 255, 255, 0.62)' }}>
            Start a voice turn to populate the streaming event feed.
          </div>
        )}
      </div>
    </section>
  );
}
