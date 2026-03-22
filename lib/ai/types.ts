export type DocumentIngestionStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'unsupported';

export type VoiceSessionState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

export type VoiceInvocationSource = 'gesture' | 'button' | 'system';

export type VoiceEventBase = {
  sessionId: string;
  roomName: string;
  ts: number;
};

export type VoiceUserInputEvent = VoiceEventBase & {
  type: 'user_input';
  audio: string;
};

export type VoiceSTTChunkEvent = VoiceEventBase & {
  type: 'stt_chunk';
  transcript: string;
};

export type VoiceSTTOutputEvent = VoiceEventBase & {
  type: 'stt_output';
  transcript: string;
};

export type VoiceAgentChunkEvent = VoiceEventBase & {
  type: 'agent_chunk';
  text: string;
};

export type VoiceAgentEndEvent = VoiceEventBase & {
  type: 'agent_end';
};

export type VoiceToolCallEvent = VoiceEventBase & {
  type: 'tool_call';
  id: string;
  name: string;
  args: Record<string, unknown>;
};

export type VoiceToolResultEvent = VoiceEventBase & {
  type: 'tool_result';
  toolCallId: string;
  name: string;
  result: string;
};

export type VoiceTTSChunkEvent = VoiceEventBase & {
  type: 'tts_chunk';
  audio: string;
};

export type VoiceTTSEndEvent = VoiceEventBase & {
  type: 'tts_end';
};

export type VoiceErrorEvent = VoiceEventBase & {
  type: 'error';
  message: string;
  stage: 'capture' | 'stream' | 'agent' | 'tts';
};

export type MeetVoiceEvent =
  | VoiceUserInputEvent
  | VoiceSTTChunkEvent
  | VoiceSTTOutputEvent
  | VoiceAgentChunkEvent
  | VoiceAgentEndEvent
  | VoiceToolCallEvent
  | VoiceToolResultEvent
  | VoiceTTSChunkEvent
  | VoiceTTSEndEvent
  | VoiceErrorEvent;

export type VoiceAgentRequest = {
  roomName: string;
  sessionId: string;
  transcript: string;
};

export type DocumentChunkMetadata = {
  page: number;
  startOffset: number;
  endOffset: number;
  tokenCount: number;
};

export type DocumentChunkRecord = {
  chunkIndex: number;
  embedding: number[];
  metadata: DocumentChunkMetadata;
  text: string;
};

export type StoredDocumentRecord = {
  id: string;
  roomName: string;
  createdAt: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileType: 'pdf' | 'image' | 'unsupported';
  storageBucket: string;
  storageObjectPath: string;
  ingestionStatus: DocumentIngestionStatus;
  ingestionError: string | null;
  chunkCount: number;
  ingestedAt: string | null;
  ingestionAttempts: number;
  lastIngestionAttemptAt: string | null;
};

export type DocumentIngestionResult = {
  chunks: DocumentChunkRecord[];
  status: DocumentIngestionStatus;
  statusMessage: string | null;
};
