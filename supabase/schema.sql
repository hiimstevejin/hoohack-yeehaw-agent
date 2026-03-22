create table if not exists public.meet_documents (
  id text primary key,
  room_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  file_name text not null,
  file_size bigint not null,
  mime_type text not null,
  file_type text not null check (file_type in ('pdf', 'image', 'unsupported')),
  storage_bucket text not null,
  storage_object_path text not null,
  ingestion_status text not null check (ingestion_status in ('pending', 'processing', 'ready', 'failed', 'unsupported')),
  ingestion_error text,
  chunk_count integer not null default 0,
  ingested_at timestamptz,
  ingestion_attempts integer not null default 0,
  last_ingestion_attempt_at timestamptz
);

create index if not exists meet_documents_room_created_at_idx
  on public.meet_documents (room_name, created_at desc);

create index if not exists meet_documents_room_status_created_at_idx
  on public.meet_documents (room_name, ingestion_status, created_at desc);

create table if not exists public.meet_document_chunks (
  document_id text not null references public.meet_documents(id) on delete cascade,
  chunk_index integer not null,
  embedding jsonb not null default '[]'::jsonb,
  metadata jsonb not null,
  text text not null,
  primary key (document_id, chunk_index)
);

create index if not exists meet_document_chunks_document_idx
  on public.meet_document_chunks (document_id, chunk_index);

create table if not exists public.meet_voice_turns (
  turn_id text primary key,
  room_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  session_id text not null,
  participant_identity text not null,
  source text,
  final_transcript text not null default '',
  agent_response text not null default '',
  event_count integer not null default 0,
  tool_names jsonb not null default '[]'::jsonb,
  error_message text
);

create index if not exists meet_voice_turns_room_created_at_idx
  on public.meet_voice_turns (room_name, created_at desc);

create table if not exists public.meet_scene_snapshots (
  room_name text not null,
  scene_kind text not null,
  scene_version integer not null,
  snapshot jsonb not null,
  persisted_at timestamptz not null default timezone('utc', now()),
  primary key (room_name, scene_kind)
);

create or replace function public.set_meet_scene_snapshot_persisted_at()
returns trigger
language plpgsql
as $$
begin
  new.persisted_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists meet_scene_snapshot_persisted_at_trigger on public.meet_scene_snapshots;

create trigger meet_scene_snapshot_persisted_at_trigger
before update on public.meet_scene_snapshots
for each row
execute function public.set_meet_scene_snapshot_persisted_at();
