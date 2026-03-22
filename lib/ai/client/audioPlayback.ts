'use client';

const SAMPLE_RATE = 24000;

export type AudioPlayback = {
  getPendingPlaybackMs: () => number;
  push: (pcmBase64: string) => void;
  resetScheduling: () => void;
  stop: () => void;
};

export function createAudioPlayback(): AudioPlayback {
  let audioContext: AudioContext | null = null;
  let nextPlayTime = 0;
  let sourceQueue: AudioBufferSourceNode[] = [];
  let base64Queue: string[] = [];
  let isProcessing = false;

  function ensureContext() {
    if (!audioContext) {
      audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    }

    if (audioContext.state === 'suspended') {
      void audioContext.resume();
    }

    return audioContext;
  }

  function pcmBase64ToArrayBuffer(pcmBase64: string) {
    const binaryData = atob(pcmBase64);
    const arrayBuffer = new ArrayBuffer(binaryData.length);
    const uint8Array = new Uint8Array(arrayBuffer);

    for (let index = 0; index < binaryData.length; index += 1) {
      uint8Array[index] = binaryData.charCodeAt(index);
    }

    return {
      arrayBuffer,
      length: uint8Array.length,
    };
  }

  function createBuffer(arrayBuffer: ArrayBuffer, length: number) {
    const ctx = ensureContext();
    const data = new DataView(arrayBuffer);
    const audioBuffer = ctx.createBuffer(1, length / 2, SAMPLE_RATE);
    const channelData = audioBuffer.getChannelData(0);

    for (let index = 0; index < length; index += 2) {
      const sample = data.getInt16(index, true);
      channelData[index / 2] = sample / 32768;
    }

    return audioBuffer;
  }

  function sourceEnded(source: AudioBufferSourceNode) {
    const index = sourceQueue.indexOf(source);

    if (index > -1) {
      sourceQueue.splice(index, 1);
    }
  }

  function processQueue() {
    if (isProcessing) {
      return;
    }

    isProcessing = true;

    while (base64Queue.length > 0) {
      const base64 = base64Queue.shift();

      if (!base64) {
        break;
      }

      const ctx = ensureContext();
      const { arrayBuffer, length } = pcmBase64ToArrayBuffer(base64);
      const audioBuffer = createBuffer(arrayBuffer, length);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      sourceQueue.push(source);

      if (nextPlayTime < ctx.currentTime) {
        nextPlayTime = ctx.currentTime;
      }

      source.start(nextPlayTime);
      source.addEventListener('ended', () => {
        sourceEnded(source);
      });
      nextPlayTime += audioBuffer.duration;
    }

    isProcessing = false;
  }

  return {
    getPendingPlaybackMs() {
      if (!audioContext) {
        return 0;
      }

      return Math.max(0, (nextPlayTime - audioContext.currentTime) * 1000);
    },
    push(pcmBase64) {
      base64Queue.push(pcmBase64);
      processQueue();
    },
    stop() {
      base64Queue = [];

      for (const source of sourceQueue) {
        try {
          source.stop();
        } catch {
          // Ignore already-stopped nodes.
        }
      }

      sourceQueue = [];
      nextPlayTime = 0;
    },
    resetScheduling() {
      nextPlayTime = 0;
    },
  };
}
