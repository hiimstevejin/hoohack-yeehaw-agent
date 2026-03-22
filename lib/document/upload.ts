import type { DocumentChunkRecord, DocumentIngestionStatus, StoredDocumentRecord } from '@/lib/ai/types';
import {
  downloadStorageObject,
  supabaseDelete,
  supabaseInsert,
  supabasePatch,
  supabaseSelect,
  uploadStorageObject,
} from '../server/supabase';

type DocumentRow = {
  chunk_count: number;
  created_at: string;
  file_name: string;
  file_size: number;
  file_type: StoredDocumentRecord['fileType'];
  id: string;
  ingested_at: string | null;
  ingestion_attempts: number;
  ingestion_error: string | null;
  ingestion_status: DocumentIngestionStatus;
  last_ingestion_attempt_at: string | null;
  mime_type: string;
  room_name: string;
  storage_bucket: string;
  storage_object_path: string;
};

type DocumentChunkRow = {
  chunk_index: number;
  document_id: string;
  embedding: number[];
  metadata: DocumentChunkRecord['metadata'];
  text: string;
};

function sanitizeStorageSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function mapDocumentRow(row: DocumentRow): StoredDocumentRecord {
  return {
    id: row.id,
    roomName: row.room_name,
    createdAt: row.created_at,
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    fileType: row.file_type,
    storageBucket: row.storage_bucket,
    storageObjectPath: row.storage_object_path,
    ingestionStatus: row.ingestion_status,
    ingestionError: row.ingestion_error,
    chunkCount: row.chunk_count,
    ingestedAt: row.ingested_at,
    ingestionAttempts: row.ingestion_attempts,
    lastIngestionAttemptAt: row.last_ingestion_attempt_at,
  };
}

function mapChunkRow(row: DocumentChunkRow): DocumentChunkRecord {
  return {
    chunkIndex: row.chunk_index,
    embedding: Array.isArray(row.embedding) ? row.embedding : [],
    metadata: row.metadata,
    text: row.text,
  };
}

function getDocumentObjectPath(roomName: string, documentId: string, fileName: string) {
  return `${sanitizeStorageSegment(roomName)}/${sanitizeStorageSegment(documentId)}/${sanitizeStorageSegment(fileName)}`;
}

export function inferDocumentFileType(mimeType: string, fileName: string) {
  const normalizedMimeType = mimeType.toLowerCase();
  const normalizedName = fileName.toLowerCase();

  if (normalizedMimeType === 'application/pdf' || normalizedName.endsWith('.pdf')) {
    return 'pdf' as const;
  }

  if (normalizedMimeType.startsWith('image/')) {
    return 'image' as const;
  }

  return 'unsupported' as const;
}

export async function writeUploadedDocument({
  bytes,
  documentId,
  fileName,
  fileSize,
  mimeType,
  roomName,
}: {
  bytes: ArrayBuffer;
  documentId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  roomName: string;
}) {
  const storageBucket = process.env.SUPABASE_DOCUMENT_BUCKET ?? 'meet-documents';
  const storageObjectPath = getDocumentObjectPath(roomName, documentId, fileName);

  await uploadStorageObject({
    body: bytes,
    contentType: mimeType,
    objectPath: storageObjectPath,
    upsert: true,
  });

  const [row] = await supabaseInsert<DocumentRow[]>(
    '/rest/v1/meet_documents',
    {
      id: documentId,
      room_name: roomName,
      file_name: fileName,
      file_size: fileSize,
      mime_type: mimeType,
      file_type: inferDocumentFileType(mimeType, fileName),
      storage_bucket: storageBucket,
      storage_object_path: storageObjectPath,
      ingestion_status: 'pending',
      ingestion_error: null,
      chunk_count: 0,
      ingested_at: null,
      ingestion_attempts: 0,
      last_ingestion_attempt_at: null,
    },
    'return=representation',
  );

  return mapDocumentRow(row);
}

export async function readDocumentRecord(documentId: string) {
  const rows = await supabaseSelect<DocumentRow[]>(
    '/rest/v1/meet_documents?select=*',
    {
      id: `eq.${documentId}`,
      limit: 1,
    },
  );
  return rows[0] ? mapDocumentRow(rows[0]) : null;
}

export async function readLatestDocumentRecord(roomName: string) {
  const rows = await supabaseSelect<DocumentRow[]>(
    '/rest/v1/meet_documents?select=*&order=created_at.desc',
    {
      room_name: `eq.${roomName}`,
      limit: 1,
    },
  );
  return rows[0] ? mapDocumentRow(rows[0]) : null;
}

export async function readLatestReadyDocumentRecord(roomName: string) {
  const rows = await supabaseSelect<DocumentRow[]>(
    '/rest/v1/meet_documents?select=*&order=created_at.desc',
    {
      room_name: `eq.${roomName}`,
      ingestion_status: 'eq.ready',
      limit: 1,
    },
  );
  return rows[0] ? mapDocumentRow(rows[0]) : null;
}

export async function readDocumentBytes(record: StoredDocumentRecord) {
  return downloadStorageObject(record.storageObjectPath);
}

export async function readDocumentChunks(documentId: string) {
  const rows = await supabaseSelect<DocumentChunkRow[]>(
    '/rest/v1/meet_document_chunks?select=*&order=chunk_index.asc',
    {
      document_id: `eq.${documentId}`,
    },
  );
  return rows.map(mapChunkRow);
}

export async function writeDocumentChunks(documentId: string, chunks: DocumentChunkRecord[]) {
  await supabaseDelete('/rest/v1/meet_document_chunks', {
    document_id: `eq.${documentId}`,
  });

  if (chunks.length === 0) {
    return;
  }

  await supabaseInsert<DocumentChunkRow[]>(
    '/rest/v1/meet_document_chunks',
    chunks.map((chunk) => ({
      document_id: documentId,
      chunk_index: chunk.chunkIndex,
      embedding: chunk.embedding,
      metadata: chunk.metadata,
      text: chunk.text,
    })),
  );
}

export async function updateDocumentIngestionState(
  documentId: string,
  updates: {
    chunkCount?: number;
    ingestedAt?: string | null;
    ingestionError?: string | null;
    ingestionStatus?: DocumentIngestionStatus;
    incrementAttemptCount?: boolean;
    lastIngestionAttemptAt?: string | null;
  },
) {
  const current = await readDocumentRecord(documentId);

  if (!current) {
    return null;
  }

  const payload: Partial<DocumentRow> = {
    chunk_count: updates.chunkCount ?? current.chunkCount,
    ingested_at: updates.ingestedAt === undefined ? current.ingestedAt : updates.ingestedAt,
    ingestion_error:
      updates.ingestionError === undefined ? current.ingestionError : updates.ingestionError,
    ingestion_status:
      updates.ingestionStatus === undefined ? current.ingestionStatus : updates.ingestionStatus,
    ingestion_attempts: updates.incrementAttemptCount
      ? current.ingestionAttempts + 1
      : current.ingestionAttempts,
    last_ingestion_attempt_at:
      updates.lastIngestionAttemptAt === undefined
        ? current.lastIngestionAttemptAt
        : updates.lastIngestionAttemptAt,
  };

  const rows = await supabasePatch<DocumentRow[]>(
    '/rest/v1/meet_documents',
    payload,
    {
      id: `eq.${documentId}`,
    },
  );

  return rows[0] ? mapDocumentRow(rows[0]) : current;
}
