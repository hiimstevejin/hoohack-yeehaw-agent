import { NextResponse } from 'next/server';

import { readDocumentChunks, readLatestDocumentRecord } from '@/lib/document/upload';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomName = searchParams.get('roomName');

  if (!roomName) {
    return NextResponse.json({ error: 'roomName is required.' }, { status: 400 });
  }

  const record = await readLatestDocumentRecord(roomName);

  if (!record) {
    return NextResponse.json({ document: null });
  }

  const chunks = await readDocumentChunks(record.id);

  return NextResponse.json({
    document: {
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
    },
  });
}
