'use client';

import * as React from 'react';

type CowboyHatOverlayProps = {
  videoElement: HTMLVideoElement | null;
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

type HatPose = {
  visible: boolean;
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  rotationDeg: number;
};

const MEDIAPIPE_TASKS_VISION_VERSION = '0.10.33';
const MEDIAPIPE_BUNDLE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}/vision_bundle.mjs`;
const MEDIAPIPE_WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}/wasm`;
const FACE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const DEFAULT_HAT_POSE: HatPose = {
  visible: false,
  leftPercent: 50,
  topPercent: 18,
  widthPercent: 34,
  rotationDeg: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, alpha: number) {
  return from + (to - from) * alpha;
}

function smoothHatPose(current: HatPose, next: HatPose): HatPose {
  if (!current.visible) {
    return next;
  }

  return {
    visible: next.visible,
    leftPercent: lerp(current.leftPercent, next.leftPercent, 0.34),
    topPercent: lerp(current.topPercent, next.topPercent, 0.34),
    widthPercent: lerp(current.widthPercent, next.widthPercent, 0.28),
    rotationDeg: lerp(current.rotationDeg, next.rotationDeg, 0.25),
  };
}

async function loadMediapipeModule() {
  return (await import(/* webpackIgnore: true */ MEDIAPIPE_BUNDLE_URL)) as FaceLandmarkerModule;
}

function createPoseFromLandmarks(landmarks: NormalizedLandmark[]): HatPose | null {
  const forehead = landmarks[10];
  const leftEyeOuter = landmarks[33];
  const rightEyeOuter = landmarks[263];
  const chin = landmarks[152];

  if (!forehead || !leftEyeOuter || !rightEyeOuter || !chin) {
    return null;
  }

  const mirroredLeftEyeX = 1 - leftEyeOuter.x;
  const mirroredRightEyeX = 1 - rightEyeOuter.x;
  const eyeMidX = (mirroredLeftEyeX + mirroredRightEyeX) / 2;
  const eyeMidY = (leftEyeOuter.y + rightEyeOuter.y) / 2;
  const eyeDistance = Math.hypot(
    mirroredRightEyeX - mirroredLeftEyeX,
    rightEyeOuter.y - leftEyeOuter.y,
  );
  const faceHeight = Math.abs(chin.y - forehead.y);
  const widthPercent = clamp(eyeDistance * 430, 34, 82);
  const topPercent = clamp((forehead.y - faceHeight * 0.34) * 100, 4, 44);
  const rotationDeg =
    (Math.atan2(rightEyeOuter.y - leftEyeOuter.y, mirroredRightEyeX - mirroredLeftEyeX) * 180) /
    Math.PI;

  return {
    visible: true,
    leftPercent: clamp(eyeMidX * 100, 8, 92),
    topPercent,
    widthPercent,
    rotationDeg: clamp(rotationDeg, -18, 18),
  };
}

export function CowboyHatOverlay({ videoElement, compact = false }: CowboyHatOverlayProps) {
  const [hatPose, setHatPose] = React.useState<HatPose>(DEFAULT_HAT_POSE);
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
    if (!videoElement) {
      setStatus('idle');
      setHatPose(DEFAULT_HAT_POSE);
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

          const activeVideoElement = videoElement;
          const faceLandmarker = faceLandmarkerRef.current;

          if (
            !activeVideoElement ||
            !faceLandmarker ||
            activeVideoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
          ) {
            return;
          }

          if (activeVideoElement.currentTime === lastProcessedVideoTimeRef.current) {
            return;
          }

          lastProcessedVideoTimeRef.current = activeVideoElement.currentTime;
          const result = faceLandmarker.detectForVideo(activeVideoElement, performance.now());
          const primaryFace = result.faceLandmarks[0];
          const nextPose = primaryFace ? createPoseFromLandmarks(primaryFace) : null;

          if (!nextPose) {
            setHatPose((current) => ({
              ...current,
              visible: false,
            }));
            return;
          }

          setHatPose((current) => smoothHatPose(current, nextPose));
        };

        frameRef.current = window.requestAnimationFrame(detectFrame);
      } catch {
        if (cancelled || !mountedRef.current) {
          return;
        }

        setStatus('error');
        setHatPose((current) => ({
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
  }, [videoElement]);

  if ((status !== 'tracking' && status !== 'loading') || !hatPose.visible) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: `${hatPose.leftPercent}%`,
          top: `${hatPose.topPercent}%`,
          width: `${hatPose.widthPercent}%`,
          minWidth: compact ? '124px' : '190px',
          maxWidth: compact ? '228px' : '430px',
          transform: `translate(-50%, -50%) rotate(${hatPose.rotationDeg}deg)`,
          filter: compact
            ? 'drop-shadow(0 8px 12px rgba(0, 0, 0, 0.28))'
            : 'drop-shadow(0 14px 18px rgba(0, 0, 0, 0.34))',
          transition: 'opacity 120ms ease',
          opacity: 0.98,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fun/cowboy-hat.png"
          alt=""
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            userSelect: 'none',
          }}
        />
      </div>
    </div>
  );
}
