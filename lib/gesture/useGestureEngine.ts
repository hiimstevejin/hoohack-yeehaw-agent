'use client';

import * as React from 'react';

import { classifyHands } from '@/lib/gesture/classifier';
import { gestureEngineConfig } from '@/lib/gesture/config';
import type {
  HandLandmarkerInstance,
  HandLandmarkerModule,
  HandLandmarkerResult,
} from '@/lib/gesture/mediapipe';
import {
  createInitialGestureTrackerState,
  reduceGestureFrame,
} from '@/lib/gesture/state-machine';
import type { GestureEngineFrame, GestureEngineState } from '@/lib/gesture/types';

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

const MEDIAPIPE_TASKS_VISION_VERSION = '0.10.33';
const MEDIAPIPE_BUNDLE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}/vision_bundle.mjs`;
const MEDIAPIPE_WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}/wasm`;
const HAND_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

type UseGestureEngineOptions = {
  sourceVideoElement?: HTMLVideoElement | null;
  allowOwnStream?: boolean;
};

function drawHandResults({
  canvas,
  results,
}: {
  canvas: HTMLCanvasElement;
  results: HandLandmarkerResult;
}) {
  const context = canvas.getContext('2d');

  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);

  results.landmarks.forEach((landmarks, handIndex) => {
    context.strokeStyle = handIndex === 0 ? '#4eb08c' : '#ff8c5b';
    context.fillStyle = '#dff7ee';
    context.lineWidth = 2;

    HAND_CONNECTIONS.forEach(([startIndex, endIndex]) => {
      const start = landmarks[startIndex];
      const end = landmarks[endIndex];

      context.beginPath();
      context.moveTo(start.x * canvas.width, start.y * canvas.height);
      context.lineTo(end.x * canvas.width, end.y * canvas.height);
      context.stroke();
    });

    landmarks.forEach((landmark) => {
      context.beginPath();
      context.arc(landmark.x * canvas.width, landmark.y * canvas.height, 3, 0, Math.PI * 2);
      context.fill();
    });
  });
}

export function useGestureEngine({
  sourceVideoElement,
  allowOwnStream = false,
}: UseGestureEngineOptions = {}) {
  const internalVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const frameRef = React.useRef<GestureEngineFrame | null>(null);
  const frameListenersRef = React.useRef(new Set<(frame: GestureEngineFrame) => void>());
  const trackerStateRef = React.useRef(createInitialGestureTrackerState());
  const animationFrameRef = React.useRef<number | null>(null);
  const handLandmarkerRef = React.useRef<HandLandmarkerInstance | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const lastProcessedVideoTimeRef = React.useRef(-1);
  const lastFrameTimestampRef = React.useRef(0);
  const [state, setState] = React.useState<GestureEngineState>({
    status: 'idle',
    error: null,
    frame: null,
  });

  async function loadMediapipeModule() {
    return (await import(/* webpackIgnore: true */ MEDIAPIPE_BUNDLE_URL)) as HandLandmarkerModule;
  }

  React.useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (!sourceVideoElement && !allowOwnStream) {
        setState({
          status: 'idle',
          error: null,
          frame: null,
        });
        return;
      }

      setState((current) => ({
        ...current,
        status: 'loading',
        error: null,
      }));

      try {
        let activeVideoElement = sourceVideoElement ?? internalVideoRef.current;

        if (!sourceVideoElement && allowOwnStream) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user',
            },
            audio: false,
          });

          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          streamRef.current = stream;

          if (!activeVideoElement) {
            throw new Error('Gesture video element is unavailable.');
          }

          activeVideoElement.srcObject = stream;
          activeVideoElement.muted = true;
          activeVideoElement.playsInline = true;
          await activeVideoElement.play();
        } else if (activeVideoElement && activeVideoElement.readyState < HTMLMediaElement.HAVE_METADATA) {
          await activeVideoElement.play().catch(() => undefined);
        }

          const resolvedVideoElement = sourceVideoElement ?? internalVideoRef.current;

          if (!resolvedVideoElement) {
            throw new Error('Unable to resolve a video source for gesture detection.');
          }

        const mediapipe = await loadMediapipeModule();
        const vision = await mediapipe.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE_URL);

        if (cancelled) {
          return;
        }

        handLandmarkerRef.current = await mediapipe.HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: HAND_LANDMARKER_MODEL_URL,
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
        });

        if (cancelled) {
          return;
        }

        setState((current) => ({
          ...current,
          status: 'ready',
          error: null,
        }));

          const drawFrame = () => {
            if (cancelled) {
              return;
            }

            const video = sourceVideoElement ?? internalVideoRef.current;
            const canvas = canvasRef.current;
            const handLandmarker = handLandmarkerRef.current;

          if (!video || !canvas || !handLandmarker) {
            animationFrameRef.current = window.requestAnimationFrame(drawFrame);
            return;
          }

          if (video.videoWidth > 0 && video.videoHeight > 0) {
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }
          }

          const hasFreshFrame = video.currentTime !== lastProcessedVideoTimeRef.current;

          if (hasFreshFrame && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            lastProcessedVideoTimeRef.current = video.currentTime;
            const timestamp = performance.now();
            const results = handLandmarker.detectForVideo(video, timestamp);
            const poses = classifyHands(results);
            const frame = reduceGestureFrame({
              poses,
              timestamp,
              state: trackerStateRef.current,
            });

            frameRef.current = frame;
            frameListenersRef.current.forEach((listener) => {
              listener(frame);
            });

            if (
              !frame.trackingActive &&
              timestamp - lastFrameTimestampRef.current > gestureEngineConfig.handLossTimeoutMs
            ) {
              trackerStateRef.current.stableGesture = 'NONE';
            } else {
              lastFrameTimestampRef.current = timestamp;
            }

            drawHandResults({ canvas, results });

            setState((current) => ({
              ...current,
              frame,
            }));
          }

          animationFrameRef.current = window.requestAnimationFrame(drawFrame);
        };

        animationFrameRef.current = window.requestAnimationFrame(drawFrame);
      } catch (error) {
        setState({
          status: 'error',
          error: error instanceof Error ? error.message : 'Unable to start gesture engine.',
          frame: null,
        });
      }
    }

    void setup();

    return () => {
      cancelled = true;

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }

      handLandmarkerRef.current?.close();
      handLandmarkerRef.current = null;
      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    };
  }, [allowOwnStream, sourceVideoElement]);

  const subscribeFrame = React.useCallback((listener: (frame: GestureEngineFrame) => void) => {
    frameListenersRef.current.add(listener);

    return () => {
      frameListenersRef.current.delete(listener);
    };
  }, []);

  return {
    state,
    canvasRef,
    frameRef,
    internalVideoRef,
    subscribeFrame,
  };
}
