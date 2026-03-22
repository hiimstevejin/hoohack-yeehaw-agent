export namespace AssemblyAISTTMessage {
  export type Begin = {
    type: 'Begin';
    id: string;
    expires_at: number;
  };

  export type Turn = {
    type: 'Turn';
    turn_order: number;
    turn_is_formatted: boolean;
    end_of_turn: boolean;
    transcript: string;
    end_of_turn_confidence: number;
    words: Array<{
      text: string;
      word_is_final: boolean;
      start: number;
      end: number;
      confidence: number;
    }>;
  };

  export type Termination = {
    type: 'Termination';
    audio_duration_seconds: number;
    session_duration_seconds: number;
  };

  export type Error = {
    type: 'Error';
    error: string;
  };
}

export type AssemblyAISTTMessage =
  | AssemblyAISTTMessage.Begin
  | AssemblyAISTTMessage.Turn
  | AssemblyAISTTMessage.Termination
  | AssemblyAISTTMessage.Error;
