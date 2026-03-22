import { NextResponse } from 'next/server';

import { isHighlightSceneSnapshot } from '@/lib/highlight/persistence';
import { supabaseInsert, supabaseSelect } from '@/lib/server/supabase';

type RouteContext = {
  params: Promise<{
    roomName: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { roomName } = await context.params;
  const rows = await supabaseSelect<
    Array<{
      scene_kind: string;
      scene_version: number;
      snapshot: unknown;
    }>
  >('/rest/v1/meet_scene_snapshots?select=scene_kind,scene_version,snapshot', {
    room_name: `eq.${roomName}`,
    scene_kind: 'eq.screen-highlight',
    limit: 1,
  });

  const row = rows[0];

  if (!row || !isHighlightSceneSnapshot(row.snapshot)) {
    return NextResponse.json({ snapshot: null });
  }

  return NextResponse.json({
    sceneVersion: row.scene_version,
    snapshot: row.snapshot,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { roomName } = await context.params;
  const payload = await request.json();

  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof (payload as Record<string, unknown>).sceneVersion !== 'number' ||
    !isHighlightSceneSnapshot((payload as Record<string, unknown>).snapshot)
  ) {
    return NextResponse.json({ error: 'Invalid scene snapshot payload.' }, { status: 400 });
  }

  const body = payload as {
    sceneVersion: number;
    snapshot: unknown;
  };

  await supabaseInsert(
    '/rest/v1/meet_scene_snapshots',
    {
      room_name: roomName,
      scene_kind: 'screen-highlight',
      scene_version: body.sceneVersion,
      snapshot: body.snapshot,
    },
    'resolution=merge-duplicates,return=representation',
  );

  return NextResponse.json({ ok: true });
}
