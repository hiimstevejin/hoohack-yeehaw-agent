export type NormalizedLandmark = {
  x: number;
  y: number;
  z?: number;
};

export type HandednessCategory = {
  categoryName: string;
};

export type HandLandmarkerResult = {
  landmarks: NormalizedLandmark[][];
  handednesses: HandednessCategory[][];
};

export type HandLandmarkerInstance = {
  detectForVideo(video: HTMLVideoElement, timestamp: number): HandLandmarkerResult;
  close(): void;
};

export type HandLandmarkerModule = {
  FilesetResolver: {
    forVisionTasks(basePath: string): Promise<unknown>;
  };
  HandLandmarker: {
    createFromOptions(
      vision: unknown,
      options: {
        baseOptions: {
          modelAssetPath: string;
        };
        runningMode: 'VIDEO';
        numHands: number;
        minHandDetectionConfidence?: number;
        minTrackingConfidence?: number;
        minHandPresenceConfidence?: number;
      },
    ): Promise<HandLandmarkerInstance>;
  };
};
