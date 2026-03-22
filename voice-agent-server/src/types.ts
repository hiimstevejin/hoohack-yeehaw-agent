export namespace MeetVoiceAgentEvent {
  interface BaseEvent {
    type: string;
    ts: number;
    roomName: string;
    sessionId: string;
  }

  export interface UserInput extends BaseEvent {
    type: 'user_input';
    audio: string;
  }

  export interface STTChunk extends BaseEvent {
    type: 'stt_chunk';
    transcript: string;
  }

  export interface STTOutput extends BaseEvent {
    type: 'stt_output';
    transcript: string;
  }

  export type STTEvent = STTChunk | STTOutput;

  export interface AgentChunk extends BaseEvent {
    type: 'agent_chunk';
    text: string;
  }

  export interface AgentEnd extends BaseEvent {
    type: 'agent_end';
  }

  export interface ToolCall extends BaseEvent {
    type: 'tool_call';
    id: string;
    name: string;
    args: Record<string, unknown>;
  }

  export interface ToolResult extends BaseEvent {
    type: 'tool_result';
    toolCallId: string;
    name: string;
    result: string;
  }

  export type AgentEvent = AgentChunk | AgentEnd | ToolCall | ToolResult;

  export interface TTSChunk extends BaseEvent {
    type: 'tts_chunk';
    audio: string;
  }

  export interface TTSEnd extends BaseEvent {
    type: 'tts_end';
  }

  export interface ErrorEvent extends BaseEvent {
    type: 'error';
    stage: 'capture' | 'stream' | 'agent' | 'tts';
    message: string;
  }
}

export type MeetVoiceAgentEvent =
  | MeetVoiceAgentEvent.UserInput
  | MeetVoiceAgentEvent.STTEvent
  | MeetVoiceAgentEvent.AgentEvent
  | MeetVoiceAgentEvent.TTSChunk
  | MeetVoiceAgentEvent.TTSEnd
  | MeetVoiceAgentEvent.ErrorEvent;

export type VoiceSessionContext = {
  roomName: string;
  sessionId: string;
};

export function createVoiceEvent<T extends MeetVoiceAgentEvent['type']>(
  context: VoiceSessionContext,
  event: Omit<Extract<MeetVoiceAgentEvent, { type: T }>, 'roomName' | 'sessionId' | 'ts'>,
): Extract<MeetVoiceAgentEvent, { type: T }> {
  return {
    ...event,
    roomName: context.roomName,
    sessionId: context.sessionId,
    ts: Date.now(),
  } as Extract<MeetVoiceAgentEvent, { type: T }>;
}
