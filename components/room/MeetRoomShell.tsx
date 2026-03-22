'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  ControlBar,
  ParticipantTile,
  RoomAudioRenderer,
  VideoTrack,
  type TrackReference,
  useLocalParticipant,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';

import { DocumentUploadForm } from '@/components/document/DocumentUploadForm';
import { CowboyHatOverlay } from '@/components/fun/CowboyHatOverlay';
import { StockQuoteFaceOverlay } from '@/components/fun/StockQuoteFaceOverlay';
import { AiLoader } from '@/components/room/ai-loader';
import { ScreenShareHighlightTile } from '@/components/room/ScreenShareHighlightTile';
import { useGestureVoiceInvocation } from '@/lib/ai/useGestureVoiceInvocation';
import { useVoiceAgentSession } from '@/lib/ai/useVoiceAgentSession';
import { useGestureEngine } from '@/lib/gesture/useGestureEngine';
import { useScreenHighlightController } from '@/lib/gesture/useScreenHighlightController';
import { useSharedScreenHighlights } from '@/lib/highlight/useSharedScreenHighlights';
import { useScreenShareOverlays } from '@/lib/overlay/useScreenShareOverlays';
import { SettingsMenu } from '@/lib/SettingsMenu';

type MeetRoomShellProps = {
  showSettingsMenu?: boolean;
};

function describeVoiceState(
  state: ReturnType<typeof useVoiceAgentSession>['sessionState'],
  detail?: string,
) {
  switch (state) {
    case 'connecting':
      return 'Voice agent is waking up and opening the stream.';
    case 'listening':
      return 'Listening for your speech now.';
    case 'thinking':
      return 'Transcript locked. Waiting for the agent response.';
    case 'speaking':
      return 'Streaming the response back now.';
    case 'error':
      return detail ?? 'Voice agent failed.';
    default:
      return 'Make a fist to invoke the voice agent.';
  }
}

function LocalPreviewTile(props: {
  trackRef?: TrackReference;
  onVideoElementChange: (element: HTMLVideoElement | null) => void;
  gestureCanvasRef?: React.Ref<HTMLCanvasElement>;
  overlays?: ReturnType<typeof useScreenShareOverlays>['overlays'];
  overlaySurfaceId?: string | null;
  onDismissOverlay?: (overlayId: string) => void;
  compact?: boolean;
}) {
  const [videoElement, setVideoElement] = React.useState<HTMLVideoElement | null>(null);
  const lastVideoElementRef = React.useRef<HTMLVideoElement | null>(null);

  if (!props.trackRef) {
    return (
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          height: '100%',
          color: 'rgba(255, 255, 255, 0.58)',
          textAlign: 'center',
          padding: '1rem',
        }}
      >
        Local camera not available yet.
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <VideoTrack
        ref={(element) => {
          if (lastVideoElementRef.current === element) {
            return;
          }

          lastVideoElementRef.current = element;
          setVideoElement(element);
          props.onVideoElementChange(element);
        }}
        trackRef={props.trackRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
        }}
      />
      {props.gestureCanvasRef ? (
        <canvas
          ref={props.gestureCanvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            transform: 'scaleX(-1)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      ) : null}
      <CowboyHatOverlay videoElement={videoElement} compact={props.compact} />
      <StockQuoteFaceOverlay
        videoElement={videoElement}
        overlay={
          props.overlaySurfaceId
            ? (props.overlays?.find((overlay) => overlay.surfaceId === props.overlaySurfaceId) ??
              null)
            : null
        }
        onDismiss={props.onDismissOverlay}
        compact={props.compact}
      />
      <div
        style={{
          position: 'absolute',
          left: '0.75rem',
          bottom: '0.75rem',
          zIndex: 2,
          padding: '0.35rem 0.55rem',
          borderRadius: '999px',
          background: 'rgba(5, 7, 11, 0.74)',
          fontSize: '0.8rem',
        }}
      >
        You
      </div>
    </div>
  );
}

export function MeetRoomShell({ showSettingsMenu = false }: MeetRoomShellProps) {
  const room = useRoomContext();
  const { localParticipant, cameraTrack } = useLocalParticipant();
  const cameraTracks = useTracks([Track.Source.Camera], {
    onlySubscribed: false,
  });
  const screenShareTracks = useTracks([Track.Source.ScreenShare], {
    onlySubscribed: false,
  });
  const [localPreviewElement, setLocalPreviewElement] = React.useState<HTMLVideoElement | null>(
    null,
  );
  const { addHighlight, clearHighlights, getRects, removeHighlight, sceneVersion } =
    useSharedScreenHighlights();
  const { dismissOverlay, getOverlays, upsertOverlay } = useScreenShareOverlays();
  const gesture = useGestureEngine({
    sourceVideoElement: localPreviewElement,
  });
  const voiceSession = useVoiceAgentSession(room.name || 'meet-room', localParticipant.identity);
  const [isDocumentDrawerOpen, setIsDocumentDrawerOpen] = React.useState(false);

  const localTrackRef = React.useMemo<TrackReference | undefined>(() => {
    if (!cameraTrack) {
      return undefined;
    }

    return {
      participant: localParticipant,
      publication: cameraTrack,
      source: Track.Source.Camera,
    };
  }, [cameraTrack, localParticipant]);

  const remoteCameraTracks = React.useMemo(
    () =>
      cameraTracks.filter((trackRef) => {
        return trackRef.participant.identity !== localParticipant.identity;
      }),
    [cameraTracks, localParticipant.identity],
  );

  const activeScreenShareTracks = React.useMemo(() => {
    return screenShareTracks.filter((trackRef) => {
      return (
        trackRef.participant.identity !== localParticipant.identity ||
        trackRef.source === Track.Source.ScreenShare
      );
    });
  }, [screenShareTracks, localParticipant.identity]);
  const hasActiveScreenShare = activeScreenShareTracks.length > 0;
  const hasRemoteParticipants = remoteCameraTracks.length > 0;
  const shouldFloatLocalPreview = hasRemoteParticipants || hasActiveScreenShare;
  const localCameraSurfaceId = `${localParticipant.identity}:camera`;
  const primaryScreenShareSurfaceId = activeScreenShareTracks[0]
    ? `${activeScreenShareTracks[0].participant.identity}:screen-share`
    : null;
  const primaryScreenShareStrokes = React.useMemo(
    () => (primaryScreenShareSurfaceId ? getRects(primaryScreenShareSurfaceId) : []),
    [getRects, primaryScreenShareSurfaceId, sceneVersion],
  );
  const screenHighlightController = useScreenHighlightController({
    frame: gesture.state.frame,
    targetSurfaceId: primaryScreenShareSurfaceId,
    addHighlight,
    strokes: primaryScreenShareStrokes,
    removeHighlight,
  });
  useGestureVoiceInvocation({
    frame: gesture.state.frame,
    session: voiceSession,
  });
  const isVoiceInactive =
    voiceSession.sessionState === 'idle' || voiceSession.sessionState === 'error';
  const isVoiceActive =
    voiceSession.sessionState === 'connecting' || voiceSession.sessionState === 'listening';
  const isVoiceThinking = voiceSession.sessionState === 'thinking';
  const isVoiceSpeaking = voiceSession.sessionState === 'speaking';
  const isVoiceEngaged = isVoiceActive || isVoiceThinking || isVoiceSpeaking;
  const transcriptHeading = voiceSession.agentResponse
    ? 'Agent Response'
    : voiceSession.finalTranscript
      ? 'Final Transcript'
      : voiceSession.partialTranscript
        ? 'Live Transcript'
        : 'Transcript';
  const transcriptBody =
    voiceSession.agentResponse ||
    voiceSession.finalTranscript ||
    voiceSession.partialTranscript ||
    'Make a fist in frame to trigger the voice agent. The streamed transcript and response will appear here.';

  React.useEffect(() => {
    if (!voiceSession.latestOverlayRequest) {
      return;
    }

    upsertOverlay({
      ...voiceSession.latestOverlayRequest,
      surfaceId: primaryScreenShareSurfaceId ?? localCameraSurfaceId,
    });
  }, [
    localCameraSurfaceId,
    primaryScreenShareSurfaceId,
    upsertOverlay,
    voiceSession.latestOverlayRequest,
  ]);

  return (
    <div
      style={{
        height: '100dvh',
        overflow: 'hidden',
        background:
          "linear-gradient(180deg, rgba(28, 22, 17, 0.62), rgba(22, 17, 13, 0.78)), url('/CowboyBackground.png')",
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        color: 'var(--lk-fg)',
        position: 'relative',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at center, rgba(255, 231, 177, 0.08), transparent 30%), repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.02) 0, rgba(255, 255, 255, 0.02) 2px, transparent 2px, transparent 80px)',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gap: '1rem',
          height: '100%',
          padding: '1rem',
          gridTemplateColumns: 'minmax(0, 1.45fr) minmax(320px, 0.55fr)',
          gridTemplateRows: 'minmax(0, 1fr)',
          overflow: 'hidden',
        }}
      >
        <section
          style={{
            minHeight: 0,
            borderRadius: '28px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(6, 8, 12, 0.84)',
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.28)',
            backdropFilter: 'blur(16px)',
            padding: '1rem',
            display: 'grid',
            gap: '1rem',
            gridTemplateRows: 'auto minmax(0, 1fr) auto',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: '1.1rem' }}>Tavern</h1>
              <p style={{ margin: '0.35rem 0 0', color: 'rgba(255, 255, 255, 0.68)' }}>
                Welcome to Tavern. Discuss financial documents, stock prices, and predictions with
                your voice and gestures.
              </p>
            </div>
            {showSettingsMenu ? (
              <div
                style={{
                  minWidth: '280px',
                  padding: '0.75rem',
                  borderRadius: '16px',
                  background: 'rgba(255, 255, 255, 0.04)',
                }}
              >
                <SettingsMenu />
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: 'grid',
              gap: '1rem',
              minHeight: 0,
              gridTemplateRows: 'minmax(0, 1fr)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {!hasActiveScreenShare &&
            (shouldFloatLocalPreview || remoteCameraTracks.length === 0) ? (
              <div
                style={{
                  position: 'absolute',
                  top: '0',
                  left: '0',
                  width:
                    !hasActiveScreenShare && remoteCameraTracks.length === 0
                      ? '220px'
                      : hasActiveScreenShare
                        ? '220px'
                        : '260px',
                  height:
                    !hasActiveScreenShare && remoteCameraTracks.length === 0
                      ? '130px'
                      : hasActiveScreenShare
                        ? '130px'
                        : '150px',
                  zIndex: 3,
                  borderRadius: '18px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  background: 'rgba(5, 7, 11, 0.96)',
                  boxShadow: '0 18px 44px rgba(0, 0, 0, 0.34)',
                }}
              >
                {!hasActiveScreenShare && remoteCameraTracks.length === 0 ? (
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <img
                      src="/Placeholder.png"
                      alt=""
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        alignContent: 'end',
                        padding: '0.7rem',
                        background:
                          'linear-gradient(180deg, rgba(5, 7, 11, 0.06) 0%, rgba(5, 7, 11, 0.68) 100%)',
                      }}
                    >
                      <span
                        style={{
                          color: '#f5efe2',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          textShadow: '0 2px 10px rgba(0, 0, 0, 0.45)',
                        }}
                      >
                        Waiting for Participant
                      </span>
                    </div>
                  </div>
                ) : (
                  <LocalPreviewTile
                    trackRef={localTrackRef}
                    onVideoElementChange={setLocalPreviewElement}
                    gestureCanvasRef={gesture.canvasRef}
                    overlays={!hasActiveScreenShare ? getOverlays(localCameraSurfaceId) : []}
                    overlaySurfaceId={!hasActiveScreenShare ? localCameraSurfaceId : null}
                    onDismissOverlay={dismissOverlay}
                    compact
                  />
                )}
              </div>
            ) : null}

            {hasActiveScreenShare ? (
              <div
                style={{
                  display: 'grid',
                  gap: '1rem',
                  minHeight: 0,
                  gridTemplateColumns: '220px minmax(0, 1fr)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gap: '0.75rem',
                    minHeight: 0,
                    gridAutoRows: 'minmax(120px, 160px)',
                    alignContent: 'start',
                    overflow: 'auto',
                    paddingRight: '0.25rem',
                  }}
                >
                  <div
                    style={{
                      borderRadius: '18px',
                      overflow: 'hidden',
                      border: '1px solid rgba(255, 255, 255, 0.14)',
                      background: 'rgba(5, 7, 11, 0.96)',
                      minHeight: 0,
                    }}
                  >
                    <LocalPreviewTile
                      trackRef={localTrackRef}
                      onVideoElementChange={setLocalPreviewElement}
                      gestureCanvasRef={gesture.canvasRef}
                      overlays={[]}
                      overlaySurfaceId={null}
                      onDismissOverlay={dismissOverlay}
                      compact
                    />
                  </div>

                  {remoteCameraTracks.slice(0, 3).map((trackRef) => (
                    <ParticipantTile
                      key={trackRef.publication.trackSid}
                      trackRef={trackRef}
                      style={{
                        borderRadius: '18px',
                        overflow: 'hidden',
                        minHeight: 0,
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        background: 'rgba(5, 7, 11, 0.9)',
                      }}
                    />
                  ))}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: '0.75rem',
                    minHeight: 0,
                    overflow: 'hidden',
                    gridTemplateColumns: 'minmax(0, 1fr)',
                  }}
                >
                  {activeScreenShareTracks.map((trackRef) => (
                    <ScreenShareHighlightTile
                      key={trackRef.publication.trackSid}
                      trackRef={trackRef}
                      surfaceId={`${trackRef.participant.identity}:screen-share`}
                      rects={getRects(`${trackRef.participant.identity}:screen-share`)}
                      pointer={
                        screenHighlightController.targetSurfaceId ===
                        `${trackRef.participant.identity}:screen-share`
                          ? screenHighlightController.pointer
                          : null
                      }
                      pointerMode={screenHighlightController.status}
                      overlays={getOverlays(`${trackRef.participant.identity}:screen-share`)}
                      onAddHighlight={addHighlight}
                      onClearHighlights={clearHighlights}
                      onDismissOverlay={dismissOverlay}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gap: '1rem',
                  gridTemplateColumns: !shouldFloatLocalPreview
                    ? 'minmax(0, 1fr)'
                    : 'repeat(auto-fit, minmax(260px, 1fr))',
                  minHeight: 0,
                  overflow: 'hidden',
                  paddingTop: shouldFloatLocalPreview ? '0.5rem' : 0,
                }}
              >
                {!shouldFloatLocalPreview && (
                  <div
                    style={{
                      borderRadius: '22px',
                      overflow: 'hidden',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      background: 'rgba(5, 7, 11, 0.9)',
                      minHeight: 0,
                      position: 'relative',
                      minWidth: 0,
                      gridColumn: '1 / -1',
                    }}
                  >
                    <LocalPreviewTile
                      trackRef={localTrackRef}
                      onVideoElementChange={setLocalPreviewElement}
                      gestureCanvasRef={gesture.canvasRef}
                      overlays={getOverlays(localCameraSurfaceId)}
                      overlaySurfaceId={localCameraSurfaceId}
                      onDismissOverlay={dismissOverlay}
                    />
                  </div>
                )}

                {remoteCameraTracks.length > 0
                  ? remoteCameraTracks.slice(0, 3).map((trackRef) => (
                      <ParticipantTile
                        key={trackRef.publication.trackSid}
                        trackRef={trackRef}
                        style={{
                          borderRadius: '22px',
                          overflow: 'hidden',
                          minHeight: 0,
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          background: 'rgba(5, 7, 11, 0.9)',
                        }}
                      />
                    ))
                  : null}
              </div>
            )}
          </div>

          <div
            style={{
              borderRadius: '18px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '0.55rem',
              overflow: 'hidden',
            }}
          >
            <ControlBar />
          </div>
          <RoomAudioRenderer />
        </section>

        <aside
          style={{
            display: 'grid',
            gap: '1rem',
            alignContent: 'start',
            minHeight: 0,
            overflow: 'auto',
            paddingRight: '0.5rem',
            paddingBottom: '0.5rem',
          }}
        >
          <section
            style={{
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(6, 8, 12, 0.76)',
              boxShadow: '0 18px 44px rgba(0, 0, 0, 0.22)',
              backdropFilter: 'blur(12px)',
              padding: '1rem',
              color: 'rgba(255, 255, 255, 0.88)',
              display: 'grid',
              gap: '0.9rem',
            }}
          >
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '0.95rem',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  opacity: 0.78,
                }}
              >
                Yeehaw Agent
              </h2>
              <p
                style={{
                  margin: 0,
                  color: 'rgba(255, 255, 255, 0.68)',
                  lineHeight: 1.45,
                  fontSize: '0.9rem',
                }}
              >
                Ask Yeehaw about Financial documents, stock price, predictions
              </p>
            </div>

            <div
              style={{
                position: 'relative',
                width: '100%',
                borderRadius: '22px',
                overflow: 'hidden',
                background:
                  'radial-gradient(circle at top, rgba(255, 228, 182, 0.18), transparent 48%), rgba(255, 255, 255, 0.03)',
                border: `1px solid ${
                  isVoiceEngaged ? 'rgba(255, 224, 163, 0.36)' : 'rgba(255, 255, 255, 0.08)'
                }`,
                boxShadow: isVoiceEngaged
                  ? '0 18px 44px rgba(255, 197, 120, 0.12)'
                  : '0 18px 44px rgba(0, 0, 0, 0.22)',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  opacity: isVoiceInactive ? 0.28 : 0.94,
                  transformOrigin: 'center',
                  animation: isVoiceSpeaking
                    ? 'voice-agent-talk 860ms ease-in-out infinite'
                    : 'none',
                  transition: 'opacity 180ms ease, box-shadow 180ms ease, transform 180ms ease',
                }}
              >
                <Image
                  src="/voice-animation.png"
                  alt="Voice agent status illustration"
                  width={1080}
                  height={1350}
                  priority
                  style={{
                    display: 'block',
                    width: '100%',
                    height: 'auto',
                  }}
                />
                <AiLoader active={isVoiceActive} accented={false} />
                {isVoiceThinking ? (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'grid',
                      paddingTop: '13rem',
                      placeItems: 'start center',
                      zIndex: 3,
                      background:
                        'radial-gradient(circle at center, rgba(6, 8, 12, 0.2) 0%, rgba(6, 8, 12, 0.54) 62%, rgba(6, 8, 12, 0.76) 100%)',
                      color: '#D8CAB6',
                      fontSize: '1rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      textShadow: '0 2px 10px rgba(0, 0, 0, 0.45)',
                    }}
                  >
                    Thinking ...
                  </div>
                ) : null}
              </div>

              <div
                style={{
                  position: 'absolute',
                  inset: 'auto 0 0 0',
                  padding: '0.8rem 0.9rem',
                  background:
                    'linear-gradient(180deg, rgba(6, 8, 12, 0) 0%, rgba(6, 8, 12, 0.78) 38%, rgba(6, 8, 12, 0.96) 100%)',
                  display: 'grid',
                  gap: '0.3rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.78rem',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: isVoiceInactive ? 'rgba(255, 255, 255, 0.75)' : '#ffe8b8',
                      fontWeight: 700,
                    }}
                  >
                    {voiceSession.sessionState}
                  </span>
                  <span
                    style={{
                      fontSize: '0.76rem',
                      color: 'rgba(255, 255, 255, 0.65)',
                    }}
                  >
                    {voiceSession.sessionSource
                      ? `${voiceSession.sessionSource} trigger`
                      : 'waiting for trigger'}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    color: 'rgba(255, 255, 255, 0.82)',
                    lineHeight: 1.4,
                    fontSize: '0.86rem',
                  }}
                >
                  {describeVoiceState(voiceSession.sessionState, voiceSession.sessionDetail)}
                </p>
              </div>
            </div>

            <div
              style={{
                minWidth: 0,
                borderRadius: '16px',
                padding: '0.85rem',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'grid',
                gap: '0.45rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                }}
              >
                <strong style={{ fontSize: '0.88rem' }}>{transcriptHeading}</strong>
                <span style={{ fontSize: '0.76rem', color: 'rgba(255, 255, 255, 0.58)' }}>
                  {voiceSession.eventCount} events
                </span>
              </div>
              <div
                style={{
                  color: 'rgba(255, 255, 255, 0.78)',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  lineHeight: 1.5,
                  maxHeight: '180px',
                  overflow: 'auto',
                  fontSize: '0.92rem',
                }}
              >
                {transcriptBody}
              </div>
              {voiceSession.agentResponse && voiceSession.finalTranscript ? (
                <div
                  style={{
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    paddingTop: '0.55rem',
                    color: 'rgba(255, 255, 255, 0.58)',
                    fontSize: '0.8rem',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    maxHeight: '92px',
                    overflow: 'auto',
                  }}
                >
                  <strong style={{ color: 'rgba(255, 255, 255, 0.78)' }}>You said:</strong>{' '}
                  {voiceSession.finalTranscript}
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void voiceSession.start('button')}
                disabled={voiceSession.isSessionActive}
                style={{
                  borderRadius: '999px',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  background: voiceSession.isSessionActive
                    ? 'rgba(255, 255, 255, 0.12)'
                    : '#f3d39a',
                  color: '#1f1408',
                  padding: '0.6rem 0.95rem',
                  fontWeight: 600,
                  cursor: voiceSession.isSessionActive ? 'not-allowed' : 'pointer',
                }}
              >
                Start Listening
              </button>
              <button
                type="button"
                onClick={() => voiceSession.stop('button')}
                disabled={!voiceSession.isSessionActive}
                style={{
                  borderRadius: '999px',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  background: !voiceSession.isSessionActive
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(255, 180, 160, 0.9)',
                  color: '#24110b',
                  padding: '0.6rem 0.95rem',
                  fontWeight: 600,
                  cursor: !voiceSession.isSessionActive ? 'not-allowed' : 'pointer',
                }}
              >
                Stop
              </button>
            </div>
          </section>
          <style jsx>{`
            @keyframes voice-agent-talk {
              0%,
              100% {
                transform: scale(0.98);
              }
              35% {
                transform: scale(1.03);
              }
              65% {
                transform: scale(0.995);
              }
            }
          `}</style>
        </aside>

        <button
          type="button"
          onClick={() => setIsDocumentDrawerOpen((current) => !current)}
          aria-expanded={isDocumentDrawerOpen}
          aria-controls="document-drawer"
          style={{
            position: 'absolute',
            right: isDocumentDrawerOpen ? 'min(24rem, 32vw)' : '0.5rem',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 5,
            width: '2.4rem',
            height: '3.4rem',
            borderRadius: '999px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            background:
              'linear-gradient(180deg, rgba(58, 44, 33, 0.96) 0%, rgba(28, 21, 16, 0.98) 100%)',
            color: '#f3d39a',
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.28)',
            backdropFilter: 'blur(12px)',
            cursor: 'pointer',
            transition: 'right 220ms ease',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              transform: isDocumentDrawerOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 220ms ease',
              fontSize: '1.1rem',
              lineHeight: 1,
            }}
          >
            ❯
          </span>
        </button>

        <div
          id="document-drawer"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            bottom: '1rem',
            width: 'min(24rem, 32vw)',
            minWidth: '320px',
            zIndex: 4,
            pointerEvents: isDocumentDrawerOpen ? 'auto' : 'none',
            transform: isDocumentDrawerOpen ? 'translateX(0)' : 'translateX(calc(100% + 1rem))',
            transition: 'transform 220ms ease',
          }}
        >
          <section
            style={{
              height: '100%',
              display: 'grid',
              gridTemplateRows: 'auto minmax(0, 1fr)',
              gap: '0.85rem',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background:
                'linear-gradient(180deg, rgba(58, 44, 33, 0.96) 0%, rgba(28, 21, 16, 0.98) 100%)',
              boxShadow: '0 18px 44px rgba(0, 0, 0, 0.28)',
              backdropFilter: 'blur(12px)',
              padding: '1rem',
              color: 'rgba(255, 255, 255, 0.88)',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '0.95rem',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  opacity: 0.78,
                }}
              >
                Shared File
              </h2>
              <p
                style={{
                  margin: 0,
                  color: 'rgba(255, 255, 255, 0.68)',
                  lineHeight: 1.4,
                  fontSize: '0.84rem',
                }}
              >
                Upload and ingest a room document without crowding the voice panel.
              </p>
            </div>

            <div
              style={{
                minHeight: 0,
                overflow: 'auto',
                paddingRight: '0.15rem',
              }}
            >
              <DocumentUploadForm roomName={room.name || 'meet-room'} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
