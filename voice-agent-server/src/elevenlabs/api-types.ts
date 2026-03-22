export type ElevenLabsVoiceSettings = {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
  speed?: number;
};

export type ElevenLabsTTSRequest = {
  text: string;
  model_id: string;
  language_code?: string;
  voice_settings?: ElevenLabsVoiceSettings;
};
