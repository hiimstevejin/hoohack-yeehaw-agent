import type { ElevenLabsTTSRequest, ElevenLabsVoiceSettings } from './api-types.js';
import { writableIterator } from '../utils.js';
import type { MeetVoiceAgentEvent, VoiceSessionContext } from '../types.js';
import { createVoiceEvent } from '../types.js';

type ElevenLabsTTSOptions = VoiceSessionContext & {
  apiKey?: string;
  languageCode?: string;
  modelId?: string;
  outputFormat?: string;
  voiceId?: string;
  voiceSettings?: ElevenLabsVoiceSettings;
};

export class ElevenLabsTTS {
  apiKey: string;
  voiceId: string;
  modelId: string;
  outputFormat: string;
  languageCode?: string;
  voiceSettings?: ElevenLabsVoiceSettings;
  context: VoiceSessionContext;

  protected bufferIterator = writableIterator<MeetVoiceAgentEvent.TTSChunk | MeetVoiceAgentEvent.TTSEnd>();

  constructor(options: ElevenLabsTTSOptions) {
    this.apiKey = options.apiKey ?? process.env.ELEVENLABS_API_KEY ?? '';
    this.voiceId = options.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? 'JBFqnCBsd6RMkjVDRZzb';
    this.modelId = options.modelId ?? process.env.ELEVENLABS_MODEL_ID ?? 'eleven_multilingual_v2';
    this.outputFormat = options.outputFormat ?? process.env.ELEVENLABS_OUTPUT_FORMAT ?? 'pcm_24000';
    this.languageCode = options.languageCode ?? process.env.ELEVENLABS_LANGUAGE_CODE;
    this.voiceSettings = options.voiceSettings;
    this.context = {
      roomName: options.roomName,
      sessionId: options.sessionId,
    };

    if (!this.apiKey) {
      throw new Error('ElevenLabs API key is required.');
    }
  }

  async sendText(text: string) {
    if (!text.trim()) {
      return;
    }

    const params = new URLSearchParams({
      output_format: this.outputFormat,
      enable_logging: 'false',
    });

    const payload: ElevenLabsTTSRequest = {
      text,
      model_id: this.modelId,
    };

    if (this.languageCode) {
      payload.language_code = this.languageCode;
    }

    if (this.voiceSettings) {
      payload.voice_settings = this.voiceSettings;
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream?${params.toString()}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `ElevenLabs TTS request failed with ${response.status}${errorBody ? `: ${errorBody}` : ''}`,
      );
    }

    if (!response.body) {
      throw new Error('ElevenLabs TTS response did not include a stream body.');
    }

    const reader = response.body.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        if (!value || value.byteLength === 0) {
          continue;
        }

        this.bufferIterator.push(
          createVoiceEvent<'tts_chunk'>(this.context, {
            type: 'tts_chunk',
            audio: Buffer.from(value).toString('base64'),
          }),
        );
      }

      this.bufferIterator.push(
        createVoiceEvent<'tts_end'>(this.context, {
          type: 'tts_end',
        }),
      );
    } catch (error) {
      this.bufferIterator.cancel();
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  async *receiveEvents(): AsyncGenerator<MeetVoiceAgentEvent.TTSChunk | MeetVoiceAgentEvent.TTSEnd> {
    yield* this.bufferIterator;
  }

  async close() {
    this.bufferIterator.cancel();
  }
}
