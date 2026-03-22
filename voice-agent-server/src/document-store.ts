type DocumentChunkRecord = {
  chunkIndex: number;
  embedding: number[];
  metadata: {
    page: number;
    startOffset: number;
    endOffset: number;
    tokenCount: number;
  };
  text: string;
};

type StoredDocumentRecord = {
  id: string;
  createdAt: string;
  roomName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileType: 'pdf' | 'image' | 'unsupported';
  storageBucket: string;
  storageObjectPath: string;
  ingestionStatus: 'pending' | 'processing' | 'ready' | 'failed' | 'unsupported';
  ingestionError: string | null;
  chunkCount: number;
  ingestedAt: string | null;
  ingestionAttempts: number;
  lastIngestionAttemptAt: string | null;
};

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for document retrieval.');
  }

  return {
    serviceRoleKey,
    url,
  };
}

async function supabaseSelect<T>(path: string) {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const response = await fetch(`${url}${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as T;
}

export async function readLatestReadyDocument(roomName: string) {
  const documents = await supabaseSelect<
    Array<{
      chunk_count: number;
      created_at: string;
      file_name: string;
      file_size: number;
      file_type: StoredDocumentRecord['fileType'];
      id: string;
      ingested_at: string | null;
      ingestion_attempts: number;
      ingestion_error: string | null;
      ingestion_status: StoredDocumentRecord['ingestionStatus'];
      last_ingestion_attempt_at: string | null;
      mime_type: string;
      room_name: string;
      storage_bucket: string;
      storage_object_path: string;
    }>
  >(
    `/rest/v1/meet_documents?select=*&room_name=eq.${encodeURIComponent(roomName)}&ingestion_status=eq.ready&order=created_at.desc&limit=1`,
  );

  const record = documents[0];

  if (!record) {
    return null;
  }

  const chunks = await supabaseSelect<
    Array<{
      chunk_index: number;
      embedding: number[];
      metadata: DocumentChunkRecord['metadata'];
      text: string;
    }>
  >(
    `/rest/v1/meet_document_chunks?select=chunk_index,embedding,metadata,text&document_id=eq.${encodeURIComponent(record.id)}&order=chunk_index.asc`,
  );

  return {
    record: {
      id: record.id,
      createdAt: record.created_at,
      roomName: record.room_name,
      fileName: record.file_name,
      fileSize: record.file_size,
      mimeType: record.mime_type,
      fileType: record.file_type,
      storageBucket: record.storage_bucket,
      storageObjectPath: record.storage_object_path,
      ingestionStatus: record.ingestion_status,
      ingestionError: record.ingestion_error,
      chunkCount: record.chunk_count,
      ingestedAt: record.ingested_at,
      ingestionAttempts: record.ingestion_attempts,
      lastIngestionAttemptAt: record.last_ingestion_attempt_at,
    },
    chunks: chunks.map((chunk) => ({
      chunkIndex: chunk.chunk_index,
      embedding: chunk.embedding,
      metadata: chunk.metadata,
      text: chunk.text,
    })),
  };
}
