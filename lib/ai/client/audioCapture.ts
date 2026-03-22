'use client';

const workletCode = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.targetSampleRate = 16000;
    this.resampleRatio = sampleRate / this.targetSampleRate;
    this.resampleIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];

    for (let i = 0; i < channelData.length; i++) {
      this.resampleIndex += 1;
      if (this.resampleIndex >= this.resampleRatio) {
        this.resampleIndex -= this.resampleRatio;
        let sample = channelData[i];
        sample = Math.max(-1, Math.min(1, sample));
        const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        this.buffer.push(int16);
      }
    }

    const CHUNK_SIZE = 1600;
    while (this.buffer.length >= CHUNK_SIZE) {
      const chunk = this.buffer.splice(0, CHUNK_SIZE);
      const int16Array = new Int16Array(chunk);
      this.port.postMessage(int16Array.buffer, [int16Array.buffer]);
    }

    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
`;

export type AudioCapture = {
  start: (onChunk: (chunk: ArrayBuffer) => void) => Promise<void>;
  stop: () => void;
};

export function createAudioCapture(): AudioCapture {
  let audioContext: AudioContext | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let mediaStream: MediaStream | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let sinkNode: GainNode | null = null;
  let chunkCount = 0;

  return {
    async start(onChunk) {
      if (!audioContext) {
        audioContext = new AudioContext();
        const blob = new Blob([workletCode], { type: 'application/javascript' });
        const workletUrl = URL.createObjectURL(blob);
        await audioContext.audioWorklet.addModule(workletUrl);
        URL.revokeObjectURL(workletUrl);
      }

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      sourceNode = audioContext.createMediaStreamSource(mediaStream);
      workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
      sinkNode = audioContext.createGain();
      sinkNode.gain.value = 0;
      console.log('[meet/voice] audio capture ready', {
        audioContextState: audioContext.state,
        sampleRate: audioContext.sampleRate,
      });
      workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        chunkCount += 1;
        if (chunkCount <= 3) {
          console.log('[meet/voice] pcm chunk', {
            bytes: event.data.byteLength,
            chunkCount,
          });
        }
        onChunk(event.data);
      };

      sourceNode.connect(workletNode);
      workletNode.connect(sinkNode);
      sinkNode.connect(audioContext.destination);
    },
    stop() {
      workletNode?.disconnect();
      workletNode = null;
      sinkNode?.disconnect();
      sinkNode = null;
      sourceNode?.disconnect();
      sourceNode = null;
      mediaStream?.getTracks().forEach((track) => track.stop());
      mediaStream = null;
      chunkCount = 0;
    },
  };
}
