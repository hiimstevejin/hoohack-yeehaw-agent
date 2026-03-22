import { NextResponse } from 'next/server';

import { extractDocumentChunks } from '@/lib/ai/ingestion';
import {
  readDocumentBytes,
  readDocumentRecord,
  updateDocumentIngestionState,
  writeDocumentChunks,
} from '@/lib/document/upload';

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function POST(_: Request, context: RouteContext) {
  const { documentId } = await context.params;
  const record = await readDocumentRecord(documentId);

  if (!record) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  }

  await updateDocumentIngestionState(documentId, {
    chunkCount: 0,
    ingestedAt: null,
    ingestionError: null,
    ingestionStatus: 'processing',
    incrementAttemptCount: true,
    lastIngestionAttemptAt: new Date().toISOString(),
  });

  try {
    const extraction = await extractDocumentChunks({
      bytes: await readDocumentBytes(record),
      fileType: record.fileType,
    });

    await writeDocumentChunks(documentId, extraction.chunks);

    const nextRecord = await updateDocumentIngestionState(documentId, {
      chunkCount: extraction.chunks.length,
      ingestedAt: extraction.status === 'ready' ? new Date().toISOString() : null,
      ingestionError: extraction.statusMessage,
      ingestionStatus: extraction.status,
    });

    return NextResponse.json(
      {
        chunkCount: extraction.chunks.length,
        documentId,
        error: extraction.statusMessage,
        ingestionAttempts: nextRecord?.ingestionAttempts ?? 0,
        ingestionStatus: nextRecord?.ingestionStatus ?? extraction.status,
      },
      { status: extraction.status === 'ready' ? 200 : extraction.status === 'unsupported' ? 422 : 400 },
    );
  } catch (error) {
    await writeDocumentChunks(documentId, []);
    const nextRecord = await updateDocumentIngestionState(documentId, {
      chunkCount: 0,
      ingestedAt: null,
      ingestionError: error instanceof Error ? error.message : 'Document ingestion failed.',
      ingestionStatus: 'failed',
    });

    return NextResponse.json(
      {
        documentId,
        error: nextRecord?.ingestionError ?? 'Document ingestion failed.',
        ingestionAttempts: nextRecord?.ingestionAttempts ?? 0,
        ingestionStatus: 'failed',
      },
      { status: 500 },
    );
  }
}
