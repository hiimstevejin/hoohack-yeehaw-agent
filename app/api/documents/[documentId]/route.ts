import { NextResponse } from 'next/server';

import { readDocumentChunks, readDocumentRecord } from '@/lib/document/upload';

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { documentId } = await context.params;
  const record = await readDocumentRecord(documentId);

  if (!record) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  }

  const chunks = await readDocumentChunks(documentId);

  return NextResponse.json({
    chunkCount: record.chunkCount,
    chunks,
    createdAt: record.createdAt,
    documentId: record.id,
    fileName: record.fileName,
    fileSize: record.fileSize,
    fileType: record.fileType,
    ingestedAt: record.ingestedAt,
    ingestionAttempts: record.ingestionAttempts,
    ingestionError: record.ingestionError,
    ingestionStatus: record.ingestionStatus,
    lastIngestionAttemptAt: record.lastIngestionAttemptAt,
    roomName: record.roomName,
  });
}
