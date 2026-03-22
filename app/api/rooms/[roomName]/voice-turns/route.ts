import { NextResponse } from 'next/server';

import { supabaseInsert } from '@/lib/server/supabase';

type RouteContext = {
  params: Promise<{
    roomName: string;
  }>;
};

type VoiceTurnPayload = {
  agentResponse: string;
  errorMessage: string | null;
  eventCount: number;
  finalTranscript: string;
  participantIdentity: string;
  sessionId: string;
  source: string | null;
  toolNames: string[];
  turnId: string;
};

function isVoiceTurnPayload(value: unknown): value is VoiceTurnPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.turnId === 'string' &&
    typeof candidate.sessionId === 'string' &&
    typeof candidate.participantIdentity === 'string' &&
    typeof candidate.finalTranscript === 'string' &&
    typeof candidate.agentResponse === 'string' &&
    typeof candidate.eventCount === 'number' &&
    (candidate.source === null || typeof candidate.source === 'string') &&
    (candidate.errorMessage === null || typeof candidate.errorMessage === 'string') &&
    Array.isArray(candidate.toolNames) &&
    candidate.toolNames.every((toolName) => typeof toolName === 'string')
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { roomName } = await context.params;
  const payload = await request.json();

  if (!isVoiceTurnPayload(payload)) {
    return NextResponse.json({ error: 'Invalid voice turn payload.' }, { status: 400 });
  }

  await supabaseInsert(
    '/rest/v1/meet_voice_turns',
    {
      turn_id: payload.turnId,
      room_name: roomName,
      session_id: payload.sessionId,
      participant_identity: payload.participantIdentity,
      source: payload.source,
      final_transcript: payload.finalTranscript,
      agent_response: payload.agentResponse,
      event_count: payload.eventCount,
      tool_names: payload.toolNames,
      error_message: payload.errorMessage,
    },
    'resolution=merge-duplicates,return=representation',
  );

  return NextResponse.json({ ok: true });
}
