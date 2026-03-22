'use client';

import * as React from 'react';

import { FinancialOverlayCard } from '@/components/overlay/FinancialOverlayCard';
import type { SharedScreenOverlayCard } from '@/lib/overlay/types';

type StockQuoteFaceOverlayProps = {
  videoElement: HTMLVideoElement | null;
  overlay: SharedScreenOverlayCard | null;
  onDismiss?: (overlayId: string) => void;
  compact?: boolean;
};

type NormalizedLandmark = {
  x: number;
  y: number;
  z?: number;
};

type FaceLandmarkerResult = {
  faceLandmarks: NormalizedLandmark[][];
};

type FaceLandmarkerInstance = {
  detectForVideo(video: HTMLVideoElement, timestamp: number): FaceLandmarkerResult;
  close(): void;
};

type FaceLandmarkerModule = {
  FilesetResolver: {
    forVisionTasks(basePath: string): Promise<unknown>;
  };
  FaceLandmarker: {
    createFromOptions(
      vision: unknown,
      options: {
        baseOptions: {
          modelAssetPath: string;
        };
        runningMode: 'VIDEO';
        numFaces: number;
        minFaceDetectionConfidence?: number;
        minTrackingConfidence?: number;
        outputFaceBlendshapes?: boolean;
        outputFacialTransformationMatrixes?: boolean;
      },
    ): Promise<FaceLandmarkerInstance>;
  };
};

type CardPose = {
  visible: boolean;
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
};

const MEDIAPIPE_TASKS_VISION_VERSION = '0.10.33';
const MEDIAPIPE_BUNDLE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}/vision_bundle.mjs`;
const MEDIAPIPE_WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}/wasm`;
const FACE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const DEFAULT_CARD_POSE: CardPose = {
  visible: false,
  leftPercent: 72,
  topPercent: 30,
  widthPercent: 34,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, alpha: number) {
  return from + (to - from) * alpha;
}

function smoothPose(current: CardPose, next: CardPose): CardPose {
  if (!current.visible) {
    return next;
  }

  return {
    visible: next.visible,
    leftPercent: lerp(current.leftPercent, next.leftPercent, 0.28),
    topPercent: lerp(current.topPercent, next.topPercent, 0.28),
    widthPercent: lerp(current.widthPercent, next.widthPercent, 0.18),
  };
}

async function loadMediapipeModule() {
  return (await import(/* webpackIgnore: true */ MEDIAPIPE_BUNDLE_URL)) as FaceLandmarkerModule;
}

function createPoseFromLandmarks(landmarks: NormalizedLandmark[]): CardPose | null {
  const forehead = landmarks[10];
  const noseTip = landmarks[1];
  const leftEyeOuter = landmarks[33];
  const rightEyeOuter = landmarks[263];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];
  const chin = landmarks[152];

  if (
    !forehead ||
    !noseTip ||
    !leftEyeOuter ||
    !rightEyeOuter ||
    !leftCheek ||
    !rightCheek ||
    !chin
  ) {
    return null;
  }

  const mirroredLeftEyeX = 1 - leftEyeOuter.x;
  const mirroredRightEyeX = 1 - rightEyeOuter.x;
  const mirroredLeftCheekX = 1 - leftCheek.x;
  const mirroredRightCheekX = 1 - rightCheek.x;
  const faceCenterX = (mirroredLeftEyeX + mirroredRightEyeX) / 2;
  const eyeMidY = (leftEyeOuter.y + rightEyeOuter.y) / 2;
  const eyeDistance = Math.hypot(
    mirroredRightEyeX - mirroredLeftEyeX,
    rightEyeOuter.y - leftEyeOuter.y,
  );
  const faceHeight = Math.abs(chin.y - forehead.y);
  const faceBoundsLeft = Math.min(mirroredLeftCheekX, mirroredRightCheekX, 1 - noseTip.x);
  const faceBoundsRight = Math.max(mirroredLeftCheekX, mirroredRightCheekX, 1 - noseTip.x);
  const faceWidth = Math.max(faceBoundsRight - faceBoundsLeft, eyeDistance * 1.4);
  const faceWidthPercent = clamp(eyeDistance * 150, 18, 28);
  const cardWidthPercent = clamp(faceWidthPercent * 1.65, 28, 42);
  const placeOnRight = faceCenterX < 0.58;
  const edgeAnchorPercent = placeOnRight ? faceBoundsRight * 100 : faceBoundsLeft * 100;
  const horizontalGapPercent = clamp(faceWidth * 100 * 0.42, 10, 18);
  const leftPercent = clamp(
    edgeAnchorPercent +
      (placeOnRight
        ? horizontalGapPercent + cardWidthPercent / 2
        : -horizontalGapPercent - cardWidthPercent / 2),
    cardWidthPercent / 2 + 4,
    100 - cardWidthPercent / 2 - 4,
  );
  const topPercent = clamp((eyeMidY - faceHeight * 0.16) * 100, 12, 68);

  return {
    visible: true,
    leftPercent,
    topPercent,
    widthPercent: cardWidthPercent,
  };
}

export function StockQuoteFaceOverlay({
  videoElement,
  overlay,
  onDismiss,
  compact = false,
}: StockQuoteFaceOverlayProps) {
  const [cardPose, setCardPose] = React.useState<CardPose>(DEFAULT_CARD_POSE);
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'tracking' | 'error'>('idle');
  const faceLandmarkerRef = React.useRef<FaceLandmarkerInstance | null>(null);
  const frameRef = React.useRef<number | null>(null);
  const mountedRef = React.useRef(true);
  const lastProcessedVideoTimeRef = React.useRef(-1);

  React.useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!videoElement || !overlay) {
      setStatus('idle');
      setCardPose(DEFAULT_CARD_POSE);
      return;
    }

    let cancelled = false;

    async function setup() {
      const activeVideoElement = videoElement;

      if (!activeVideoElement) {
        return;
      }

      try {
        setStatus('loading');

        if (activeVideoElement.readyState < HTMLMediaElement.HAVE_METADATA) {
          await activeVideoElement.play().catch(() => undefined);
        }

        const mediapipe = await loadMediapipeModule();
        const vision = await mediapipe.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE_URL);

        if (cancelled || !mountedRef.current) {
          return;
        }

        faceLandmarkerRef.current = await mediapipe.FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: FACE_LANDMARKER_MODEL_URL,
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.55,
          minTrackingConfidence: 0.55,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });

        if (cancelled || !mountedRef.current) {
          return;
        }

        setStatus('tracking');

        const detectFrame = () => {
          if (cancelled || !mountedRef.current) {
            return;
          }

          frameRef.current = window.requestAnimationFrame(detectFrame);

          const activeVideo = videoElement;
          const faceLandmarker = faceLandmarkerRef.current;

          if (
            !activeVideo ||
            !faceLandmarker ||
            activeVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
          ) {
            return;
          }

          if (activeVideo.currentTime === lastProcessedVideoTimeRef.current) {
            return;
          }

          lastProcessedVideoTimeRef.current = activeVideo.currentTime;
          const result = faceLandmarker.detectForVideo(activeVideo, performance.now());
          const primaryFace = result.faceLandmarks[0];
          const nextPose = primaryFace ? createPoseFromLandmarks(primaryFace) : null;

          if (!nextPose) {
            setCardPose((current) => ({
              ...current,
              visible: false,
            }));
            return;
          }

          setCardPose((current) => smoothPose(current, nextPose));
        };

        frameRef.current = window.requestAnimationFrame(detectFrame);
      } catch {
        if (cancelled || !mountedRef.current) {
          return;
        }

        setStatus('error');
        setCardPose((current) => ({
          ...current,
          visible: false,
        }));
      }
    }

    void setup();

    return () => {
      cancelled = true;

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      faceLandmarkerRef.current?.close();
      faceLandmarkerRef.current = null;
    };
  }, [overlay, videoElement]);

  if (!overlay || (status !== 'tracking' && status !== 'loading') || !cardPose.visible) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 4,
      }}
    >
      <section
        style={{
          position: 'absolute',
          left: `${cardPose.leftPercent}%`,
          top: `${cardPose.topPercent}%`,
          width: `${cardPose.widthPercent}%`,
          minWidth: compact ? '150px' : '220px',
          maxWidth: compact ? '190px' : '320px',
          transform: 'translate(-50%, -50%)',
          borderRadius: compact ? '16px' : '18px',
          border: '1px solid rgba(143, 227, 192, 0.28)',
          background: 'rgba(7, 12, 18, 0.9)',
          boxShadow: compact
            ? '0 12px 28px rgba(0, 0, 0, 0.26)'
            : '0 18px 44px rgba(0, 0, 0, 0.28)',
          backdropFilter: 'blur(16px)',
          padding: compact ? '0.7rem' : '0.95rem',
          color: 'white',
          display: 'grid',
          gap: compact ? '0.5rem' : '0.7rem',
          pointerEvents: 'auto',
        }}
      >
        <FinancialOverlayCard overlay={overlay} compact={compact} onDismiss={onDismiss} />
      </section>
    </div>
  );
}
